import { useEffect, useState } from 'react';
import { InputNumber, Select, Space, Switch, Table, Tag, Typography, message } from 'antd';
import { off, onValue, ref, get, serverTimestamp, set } from 'firebase/database';
import { database } from '../../services/firebase/config';

const { Title, Text } = Typography;
const { Option } = Select;

const PART_DEFINITIONS = {
  part_1: { name: 'Phần 1: Tiên phong', scorePath: 'round_1', questionDataPath: 'round_1', hasPackages: true, manualOnly: false },
  part_2: { name: 'Phần 2: Khát vọng', scorePath: 'round_2', questionDataPath: 'round_2', hasPackages: false, manualOnly: true },
  part_3: { name: 'Phần 3: Tự hào tiến bước', scorePath: 'round_3', questionDataPath: 'round_3', hasPackages: true, manualOnly: false },
};

const EMPTY_PART2_BREAKDOWN = {
  online: 0,
  presentation: 0,
  total: 0,
  btc: 0,
  bgk_1: 0,
  bgk_2: 0,
  bgk_3: 0,
  presentationRawAverage: 0,
};

const average = (values) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
};

const normalizePart2Breakdown = (rawBreakdown = {}, fallbackTotal = 0) => {
  const breakdown = {
    ...EMPTY_PART2_BREAKDOWN,
    ...rawBreakdown,
  };

  const online = Number(breakdown.online || 0);
  const presentationRawAverage = average([
    breakdown.btc,
    breakdown.bgk_1,
    breakdown.bgk_2,
    breakdown.bgk_3,
  ]);
  const hasJudgeScores = [
    breakdown.btc,
    breakdown.bgk_1,
    breakdown.bgk_2,
    breakdown.bgk_3,
  ].some((value) => Number(value || 0) > 0);

  const presentation = hasJudgeScores
    ? Number((presentationRawAverage * 0.6).toFixed(2))
    : Number(breakdown.presentation || 0);
  const total = hasJudgeScores
    ? Number((online + presentation).toFixed(2))
    : Number(
        breakdown.total !== undefined
          ? breakdown.total
          : (fallbackTotal || online + presentation || 0)
      );

  return {
    ...breakdown,
    online,
    presentationRawAverage: Number(presentationRawAverage.toFixed(2)),
    presentation,
    total: Number(total.toFixed(2)),
  };
};

function ScoresPage() {
  const [allMatches, setAllMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [selectedMatchData, setSelectedMatchData] = useState(null);
  const [selectedPartKey, setSelectedPartKey] = useState(null);
  const [teamsInMatch, setTeamsInMatch] = useState([]);
  const [detailedScores, setDetailedScores] = useState([]);
  const [teamPartTotals, setTeamPartTotals] = useState({});
  const [customScores, setCustomScores] = useState({});
  const [part2BreakdownScores, setPart2BreakdownScores] = useState({});
  const [hideUnanswered, setHideUnanswered] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    setLoadingMatches(true);
    const matchesRef = ref(database, 'matches');
    const listener = onValue(
      matchesRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const matchesArray = Object.entries(snapshot.val()).map(([id, data]) => ({
            id,
            title: data.title,
            team_ids: data.team_ids || [],
            round_1: data.round_1,
            round_2: data.round_2,
            round_3: data.round_3,
            scores: data.scores,
            answers: data.answers,
          }));
          setAllMatches(matchesArray);
        } else {
          setAllMatches([]);
        }
        setLoadingMatches(false);
      },
      (error) => {
        message.error(`Lỗi tải danh sách trận đấu: ${error.message}`);
        setLoadingMatches(false);
      }
    );

    return () => off(matchesRef, 'value', listener);
  }, []);

  useEffect(() => {
    if (!selectedMatchId) {
      setSelectedMatchData(null);
      return;
    }

    setLoadingDetails(true);
    const matchRef = ref(database, `matches/${selectedMatchId}`);
    const listener = onValue(
      matchRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setSelectedMatchData({ id: selectedMatchId, ...snapshot.val() });
        } else {
          message.error(`Không tìm thấy dữ liệu cho trận đấu ID: ${selectedMatchId}`);
          setSelectedMatchData(null);
          setLoadingDetails(false);
        }
      },
      (error) => {
        message.error(`Lỗi tải dữ liệu trận đấu (${selectedMatchId}): ${error.message}`);
        setSelectedMatchData(null);
        setLoadingDetails(false);
      }
    );

    return () => off(matchRef, 'value', listener);
  }, [selectedMatchId]);

  useEffect(() => {
    if (!selectedMatchData?.team_ids?.length) {
      setTeamsInMatch([]);
      return;
    }

    const fetchTeams = async () => {
      const snapshots = await Promise.all(
        selectedMatchData.team_ids.map((teamId) => get(ref(database, `teams/${teamId}`)))
      );
      setTeamsInMatch(
        snapshots.map((snapshot, index) => ({
          id: selectedMatchData.team_ids[index],
          name: snapshot.exists() ? snapshot.val().name : `Đội ${selectedMatchData.team_ids[index]}`,
        }))
      );
    };

    fetchTeams();
  }, [selectedMatchData]);

  useEffect(() => {
    if (!selectedMatchData || !selectedPartKey || teamsInMatch.length === 0) {
      setDetailedScores([]);
      setTeamPartTotals({});
      setCustomScores({});
      setPart2BreakdownScores({});
      if (selectedMatchData && selectedPartKey) {
        setLoadingDetails(false);
      }
      return;
    }

    setLoadingDetails(true);
    const partConfig = PART_DEFINITIONS[selectedPartKey];
    const scoresDataRoot = selectedMatchData.scores?.[partConfig.scorePath] || {};
    const answersDataRoot = selectedPartKey === 'part_2' ? selectedMatchData.answers?.[partConfig.scorePath] || {} : null;
    const questionDataRoot = selectedMatchData[partConfig.questionDataPath];

    if (partConfig.manualOnly) {
      const fetchedCustomScores = scoresDataRoot.custom_scores || {};
      const fetchedBreakdowns = scoresDataRoot.custom_breakdown || {};
      const nextBreakdowns = {};
      const totals = {};

      teamsInMatch.forEach((team) => {
        const normalized = normalizePart2Breakdown(
          fetchedBreakdowns[team.id] || {},
          Number(fetchedCustomScores[team.id] || 0)
        );
        nextBreakdowns[team.id] = normalized;
        totals[team.id] = normalized.total;
      });

      setDetailedScores([]);
      setCustomScores(fetchedCustomScores);
      setPart2BreakdownScores(nextBreakdowns);
      setTeamPartTotals(totals);
      setLoadingDetails(false);
      return;
    }

    if (!questionDataRoot) {
      message.warn(`Không có dữ liệu câu hỏi cho ${partConfig.name} trong trận này.`);
      setDetailedScores([]);
      setCustomScores({});
      setPart2BreakdownScores({});
      setTeamPartTotals({});
      setLoadingDetails(false);
      return;
    }

    const processedScores = [];
    const questionTotals = teamsInMatch.reduce((acc, team) => ({ ...acc, [team.id]: 0 }), {});

    if (partConfig.hasPackages) {
      Object.entries(questionDataRoot).forEach(([packageId, packageContent]) => {
        if (!packageContent || typeof packageContent !== 'object') return;
        const questions = Object.keys(packageContent).filter((key) => key.startsWith('question_'));

        questions.forEach((questionKey) => {
          const questionInfo = packageContent[questionKey];
          if (!questionInfo || typeof questionInfo !== 'object') return;

          const row = {
            key: `${packageId}-${questionKey}`,
            package: packageContent.name || packageId.replace('package_', 'Gói '),
            questionNum: questionInfo.question_num || questionKey.split('_')[1],
            questionText: questionInfo.question || questionInfo.question_text,
          };

          teamsInMatch.forEach((team) => {
            const scoreEntry = scoresDataRoot?.[packageId]?.[questionKey];
            const answeredByThisTeam = scoreEntry?.team_id === team.id;
            const score = answeredByThisTeam ? Number(scoreEntry.score || 0) : 0;
            row[team.id] = score;
            row[`${team.id}_answered`] = answeredByThisTeam;
            questionTotals[team.id] += score;
          });

          processedScores.push(row);
        });
      });
    } else {
      Object.entries(questionDataRoot).forEach(([questionKey, questionInfo]) => {
        if (!questionInfo || typeof questionInfo !== 'object') return;

        const row = {
          key: questionKey,
          package: '-',
          questionNum: questionInfo.question_num || questionKey.split('_')[1],
          questionText: questionInfo.question,
        };

        teamsInMatch.forEach((team) => {
          const scoreEntry = scoresDataRoot?.[questionKey]?.[team.id];
          const answerEntry = answersDataRoot?.[questionKey]?.[team.id];
          const answered = !!scoreEntry || !!answerEntry;

          row[team.id] = Number(scoreEntry?.score || 0);
          row[`${team.id}_choice`] = scoreEntry?.choice || answerEntry?.choice || '-';
          row[`${team.id}_answered`] = answered;
          questionTotals[team.id] += Number(scoreEntry?.score || 0);
        });

        processedScores.push(row);
      });
    }

    const fetchedCustomScores = scoresDataRoot.custom_scores || {};
    const finalTotals = {};
    teamsInMatch.forEach((team) => {
      finalTotals[team.id] = Number(questionTotals[team.id] || 0) + Number(fetchedCustomScores[team.id] || 0);
    });

    const visibleScores = hideUnanswered
      ? processedScores.filter((row) => teamsInMatch.some((team) => row[`${team.id}_answered`]))
      : processedScores;

    setCustomScores(fetchedCustomScores);
    setTeamPartTotals(finalTotals);
    setDetailedScores(
      visibleScores.sort((a, b) => {
        if (a.package && b.package && a.package.localeCompare(b.package) !== 0) {
          return a.package.localeCompare(b.package);
        }
        return Number(a.questionNum) - Number(b.questionNum);
      })
    );
    setLoadingDetails(false);
  }, [selectedMatchData, selectedPartKey, teamsInMatch, hideUnanswered]);

  const handleMatchChange = (matchId) => {
    setSelectedMatchId(matchId);
    setSelectedPartKey(null);
    setDetailedScores([]);
    setTeamPartTotals({});
    setCustomScores({});
    setPart2BreakdownScores({});
    setHideUnanswered(false);
  };

  const handlePartChange = (partKey) => {
    setSelectedPartKey(partKey);
    setCustomScores({});
    setPart2BreakdownScores({});
    setTeamPartTotals({});
  };

  const handleScoreUpdate = async (recordKey, teamId, newScoreValue) => {
    if (!selectedMatchId || !selectedPartKey || !selectedMatchData) return;

    const finalScore = newScoreValue === null || newScoreValue === undefined ? 0 : Number(newScoreValue);
    const partConfig = PART_DEFINITIONS[selectedPartKey];
    const roundKey = partConfig.scorePath;
    const [packageIdOrQuestionId, questionKeyOrNull] = recordKey.split('-');
    const optimisticCopy = JSON.parse(JSON.stringify(selectedMatchData));

    if (!optimisticCopy.scores) optimisticCopy.scores = {};
    if (!optimisticCopy.scores[roundKey]) optimisticCopy.scores[roundKey] = {};

    if (partConfig.hasPackages) {
      const packageId = packageIdOrQuestionId;
      const questionKey = questionKeyOrNull;
      const teamInfo = teamsInMatch.find((team) => team.id === teamId);
      const scorePayload = {
        team_id: teamId,
        team_name: teamInfo?.name || teamId,
        score: finalScore,
        timestamp: serverTimestamp(),
      };

      try {
        await set(ref(database, `matches/${selectedMatchId}/scores/${roundKey}/${packageId}/${questionKey}`), scorePayload);
        message.success('Điểm cập nhật thành công!');
        if (!optimisticCopy.scores[roundKey][packageId]) optimisticCopy.scores[roundKey][packageId] = {};
        optimisticCopy.scores[roundKey][packageId][questionKey] = { ...scorePayload, timestamp: Date.now() };
        setSelectedMatchData(optimisticCopy);
      } catch (error) {
        message.error(`Lỗi cập nhật điểm: ${error.message}`);
      }

      return;
    }

    const questionKey = packageIdOrQuestionId;
    const scoreRef = ref(database, `matches/${selectedMatchId}/scores/${roundKey}/${questionKey}/${teamId}`);

    try {
      const snapshot = await get(scoreRef);
      const existingData = snapshot.exists() ? snapshot.val() : {};
      const payload = {
        ...existingData,
        score: finalScore,
        team_id: teamId,
        team_name: teamsInMatch.find((team) => team.id === teamId)?.name || teamId,
        timestamp: serverTimestamp(),
      };

      await set(scoreRef, payload);
      message.success('Điểm cập nhật thành công!');
      if (!optimisticCopy.scores[roundKey][questionKey]) optimisticCopy.scores[roundKey][questionKey] = {};
      optimisticCopy.scores[roundKey][questionKey][teamId] = { ...payload, timestamp: Date.now() };
      setSelectedMatchData(optimisticCopy);
    } catch (error) {
      message.error(`Lỗi cập nhật điểm: ${error.message}`);
    }
  };

  const handleCustomScoreUpdate = async (teamId, newCustomScoreValue) => {
    if (!selectedMatchId || !selectedPartKey || !selectedMatchData) return;

    const scoreValue = newCustomScoreValue === null || newCustomScoreValue === undefined ? 0 : Number(newCustomScoreValue);
    const roundKey = PART_DEFINITIONS[selectedPartKey].scorePath;

    try {
      await set(ref(database, `matches/${selectedMatchId}/scores/${roundKey}/custom_scores/${teamId}`), scoreValue);
      message.success(`Điểm tùy chỉnh cho đội ${teamsInMatch.find((team) => team.id === teamId)?.name} đã cập nhật.`);
    } catch (error) {
      message.error(`Lỗi cập nhật điểm tùy chỉnh: ${error.message}`);
    }
  };

  const handlePart2BreakdownUpdate = async (teamId, field, rawValue) => {
    if (!selectedMatchId || selectedPartKey !== 'part_2' || !selectedMatchData) return;

    const safeValue = rawValue === null || rawValue === undefined ? 0 : Number(rawValue);
    const previousBreakdown = part2BreakdownScores[teamId] || EMPTY_PART2_BREAKDOWN;
    const nextBreakdown = normalizePart2Breakdown({
      ...previousBreakdown,
      [field]: safeValue,
    });

    try {
      await set(ref(database, `matches/${selectedMatchId}/scores/round_2/custom_breakdown/${teamId}`), nextBreakdown);
      await set(ref(database, `matches/${selectedMatchId}/scores/round_2/custom_scores/${teamId}`), nextBreakdown.total);
      message.success(`Điểm phần 2 cho đội ${teamsInMatch.find((team) => team.id === teamId)?.name} đã cập nhật.`);
    } catch (error) {
      message.error(`Lỗi cập nhật điểm phần 2: ${error.message}`);
    }
  };

  const tableColumns = [
    { title: 'Gói/Câu hỏi', dataIndex: 'package', key: 'package', width: 150, fixed: 'left' },
    { title: 'STT', dataIndex: 'questionNum', key: 'questionNum', width: 80, fixed: 'left' },
    ...teamsInMatch.map((team) => ({
      title: team.name,
      dataIndex: team.id,
      key: team.id,
      width: 150,
      render: (score, record) => {
        const answered = record[`${team.id}_answered`];
        const choice = selectedPartKey === 'part_2' ? record[`${team.id}_choice`] : null;
        const displayScore = score === null || score === undefined ? 0 : Number(score);

        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <InputNumber
              min={0}
              value={displayScore}
              onChange={(value) => handleScoreUpdate(record.key, team.id, value)}
              style={{ width: '80px', backgroundColor: answered ? '#e6f7ff' : undefined }}
            />
            {choice && <Text type="secondary">Chọn: {choice}</Text>}
          </Space>
        );
      },
    })),
    { title: 'Nội dung câu hỏi', dataIndex: 'questionText', key: 'questionText', width: 300, ellipsis: true },
  ];

  return (
    <div>
      <Title level={2}>Xem và Chỉnh Sửa Điểm Chi Tiết</Title>
      <Space style={{ marginBottom: 16 }}>
        <Select
          style={{ width: 300 }}
          placeholder="Chọn trận đấu"
          loading={loadingMatches}
          onChange={handleMatchChange}
          value={selectedMatchId}
        >
          {allMatches.map((match) => (
            <Option key={match.id} value={match.id}>
              {match.title}
            </Option>
          ))}
        </Select>
        {selectedMatchId && (
          <Select
            style={{ width: 250 }}
            placeholder="Chọn phần thi"
            onChange={handlePartChange}
            value={selectedPartKey}
          >
            {Object.entries(PART_DEFINITIONS).map(([key, part]) => (
              <Option key={key} value={key}>
                {part.name}
              </Option>
            ))}
          </Select>
        )}
      </Space>

      {selectedMatchId && selectedPartKey && teamsInMatch.length > 0 && (
        <>
          <div style={{ marginBottom: 16, marginTop: 16 }}>
            <Title level={4}>Tổng điểm {PART_DEFINITIONS[selectedPartKey]?.name}:</Title>
            <Space wrap>
              {teamsInMatch.map((team) => (
                <Tag color="blue" key={team.id} style={{ fontSize: '16px', padding: '5px 10px', marginBottom: '5px' }}>
                  {team.name}: {teamPartTotals[team.id] === undefined ? '...' : teamPartTotals[team.id]}
                </Tag>
              ))}
            </Space>
          </div>

          <div style={{ marginBottom: 20 }}>
            {selectedPartKey === 'part_2' ? (
              <>
                <Title level={5}>Điểm Phần 2 theo cơ cấu 100%:</Title>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {teamsInMatch.map((team) => {
                    const breakdown = part2BreakdownScores[team.id] || EMPTY_PART2_BREAKDOWN;
                    return (
                      <div
                        key={`part2_breakdown_${team.id}`}
                        style={{
                          marginBottom: 4,
                          padding: '12px 14px',
                          border: '1px solid #d9d9d9',
                          borderRadius: 10,
                          background: '#fafafa',
                        }}
                      >
                        <Space wrap size={[12, 10]} align="center" style={{ width: '100%' }}>
                          <Text style={{ minWidth: '150px', fontWeight: 600 }}>{team.name}:</Text>
                          <Text>Trực tuyến (40%)</Text>
                          <InputNumber
                            min={0}
                            max={40}
                            value={breakdown.online}
                            onChange={(value) => handlePart2BreakdownUpdate(team.id, 'online', value)}
                            style={{ width: 90 }}
                          />
                          <Text>BTC</Text>
                          <InputNumber min={0} max={100} value={breakdown.btc} onChange={(value) => handlePart2BreakdownUpdate(team.id, 'btc', value)} style={{ width: 80 }} />
                          <Text>BGK 1</Text>
                          <InputNumber min={0} max={100} value={breakdown.bgk_1} onChange={(value) => handlePart2BreakdownUpdate(team.id, 'bgk_1', value)} style={{ width: 80 }} />
                          <Text>BGK 2</Text>
                          <InputNumber min={0} max={100} value={breakdown.bgk_2} onChange={(value) => handlePart2BreakdownUpdate(team.id, 'bgk_2', value)} style={{ width: 80 }} />
                          <Text>BGK 3</Text>
                          <InputNumber min={0} max={100} value={breakdown.bgk_3} onChange={(value) => handlePart2BreakdownUpdate(team.id, 'bgk_3', value)} style={{ width: 80 }} />
                          <Text type="secondary">TB 4 cột: {breakdown.presentationRawAverage}</Text>
                          <Text>Thuyết minh (60%)</Text>
                          <InputNumber min={0} max={60} value={breakdown.presentation} style={{ width: 90 }} readOnly />
                          <Tag color="blue" style={{ fontSize: '14px', padding: '4px 10px', marginInlineStart: 8 }}>
                            Tổng: {breakdown.total}/100
                          </Tag>
                        </Space>
                      </div>
                    );
                  })}
                </Space>
              </>
            ) : (
              <>
                <Title level={5}>Điểm Thưởng/Phụ cho {PART_DEFINITIONS[selectedPartKey]?.name}:</Title>
                <Space wrap>
                  {teamsInMatch.map((team) => (
                    <Space key={`custom_${team.id}`} align="center" style={{ marginRight: 15, marginBottom: 10 }}>
                      <Text style={{ minWidth: '100px', textAlign: 'right' }}>{team.name}:</Text>
                      <InputNumber
                        value={customScores[team.id] || 0}
                        onChange={(value) => handleCustomScoreUpdate(team.id, value)}
                        placeholder="Điểm"
                        style={{ width: 80 }}
                      />
                    </Space>
                  ))}
                </Space>
              </>
            )}
          </div>

          {!PART_DEFINITIONS[selectedPartKey]?.manualOnly && (
            <Space style={{ marginBottom: 16 }}>
              <Text>Ẩn câu hỏi chưa có đội trả lời/ghi điểm:</Text>
              <Switch checked={hideUnanswered} onChange={setHideUnanswered} />
            </Space>
          )}

          {PART_DEFINITIONS[selectedPartKey]?.manualOnly && (
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              {selectedPartKey === 'part_2'
                ? 'Phần 2 gồm Trực tuyến 40% và Thuyết minh 60%. Điểm thuyết minh được tính bằng trung bình của 1 cột BTC và 3 cột BGK, sau đó nhân 60%.'
                : 'Phần thi này chấm theo hình thức thuyết trình. Nhập điểm trực tiếp cho từng đội ở phần trên.'}
            </Text>
          )}
        </>
      )}

      {selectedMatchId && selectedPartKey && !PART_DEFINITIONS[selectedPartKey]?.manualOnly && (
        <Table
          columns={tableColumns}
          dataSource={detailedScores}
          rowKey="key"
          loading={loadingDetails}
          bordered
          scroll={{ x: 1300 }}
          pagination={{ pageSize: 20 }}
        />
      )}
    </div>
  );
}

export default ScoresPage;
