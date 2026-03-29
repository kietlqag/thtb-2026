import { useState, useEffect } from 'react';
import { Table, Select, Button, message, Typography, Space, InputNumber, Tag, Switch } from 'antd';
import { database } from '../../services/firebase/config';
import { ref, get, set, onValue, off, serverTimestamp } from 'firebase/database';

const { Title, Text } = Typography;
const { Option } = Select;

const PART_DEFINITIONS = {
  part_1: { name: "Phần 1: Tiên phong", scorePath: 'round_1', questionDataPath: 'round_1', hasPackages: true, manualOnly: false },
  part_2: { name: "Phần 2: Khát vọng", scorePath: 'round_2', questionDataPath: 'round_2', hasPackages: false, manualOnly: true },
  part_3: { name: "Phần 3: Tự hào tiến bước", scorePath: 'round_3', questionDataPath: 'round_3', hasPackages: true, manualOnly: false },
};

function ScoresPage() {
  const emptyPart2Breakdown = { online: 0, presentation: 0, total: 0 };
  const [allMatches, setAllMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [selectedMatchData, setSelectedMatchData] = useState(null);
  const [selectedPartKey, setSelectedPartKey] = useState(null); // 'part_1', 'part_2', 'part_3'

  const [teamsInMatch, setTeamsInMatch] = useState([]); // [{id, name}, ...]
  const [detailedScores, setDetailedScores] = useState([]); // Data for the table
  const [teamPartTotals, setTeamPartTotals] = useState({}); // { teamId: totalScoreForPart }
  const [customScores, setCustomScores] = useState({}); // { teamId: score } for the selected part
  const [part2BreakdownScores, setPart2BreakdownScores] = useState({}); // { teamId: { online, presentation, total } }
  const [hideUnanswered, setHideUnanswered] = useState(false); // State for hiding unanswered questions

  const [loadingMatches, setLoadingMatches] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Fetch all matches
  useEffect(() => {
    setLoadingMatches(true);
    const matchesRef = ref(database, 'matches');
    const listener = onValue(matchesRef, (snapshot) => {
      if (snapshot.exists()) {
        const matchesArray = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          title: data.title,
          team_ids: data.team_ids || [],
          // Include round data for quicker access if needed later, or fetch on demand
          round_1: data.round_1,
          round_2: data.round_2,
          round_3: data.round_3,
          scores: data.scores, // Assuming scores are stored under matchId/scores
          answers: data.answers // Assuming answers are stored under matchId/answers
        }));
        setAllMatches(matchesArray);
      } else {
        setAllMatches([]);
      }
      setLoadingMatches(false);
    }, (error) => {
      message.error('Lỗi tải danh sách trận đấu: ' + error.message);
      setLoadingMatches(false);
    });
    return () => off(matchesRef, 'value', listener);
  }, []);

  // Real-time listener for selected match data
  useEffect(() => {
    if (!selectedMatchId) {
      setSelectedMatchData(null);
      return;
    }

    setLoadingDetails(true); // Indicate loading when match changes
    const matchDetailRef = ref(database, `matches/${selectedMatchId}`);
    const listener = onValue(matchDetailRef, (snapshot) => {
      if (snapshot.exists()) {
        setSelectedMatchData({ id: selectedMatchId, ...snapshot.val() });
        // setLoadingDetails(false) will be handled by the score processing useEffect
      } else {
        message.error(`Không tìm thấy dữ liệu cho trận đấu ID: ${selectedMatchId}`);
        setSelectedMatchData(null);
        setLoadingDetails(false);
      }
    }, (error) => {
      message.error(`Lỗi tải dữ liệu trận đấu (${selectedMatchId}): ${error.message}`);
      setSelectedMatchData(null);
      setLoadingDetails(false);
    });

    return () => {
      off(matchDetailRef, 'value', listener);
    };
  }, [selectedMatchId]);

  // Fetch team details when selectedMatchData or its team_ids change
  useEffect(() => {
    if (selectedMatchData && selectedMatchData.team_ids) {
      const fetchTeamDetails = async () => {
        // setLoadingDetails(true); // Already handled by match data listener
        const teamPromises = selectedMatchData.team_ids.map(teamId =>
          get(ref(database, `teams/${teamId}`))
        );
        const teamSnapshots = await Promise.all(teamPromises);
        const teamsData = teamSnapshots.map((snap, index) => ({
          id: selectedMatchData.team_ids[index],
          name: snap.exists() ? snap.val().name : `Đội ${selectedMatchData.team_ids[index]}`,
        }));
        setTeamsInMatch(teamsData);
        // setLoadingDetails(false); // Let the main score processing useEffect handle this
      };
      fetchTeamDetails();
    } else {
      setTeamsInMatch([]);
    }
  }, [selectedMatchData]); // Depends on selectedMatchData

  // Process and display scores when match data, part, teams, or hideUnanswered filter change
  useEffect(() => {
    // setLoadingDetails(true) should be set at the start of this effect
    // and setLoadingDetails(false) at the end.
    if (!selectedMatchData || !selectedPartKey || teamsInMatch.length === 0) {
      setDetailedScores([]);
      setTeamPartTotals({});
      setCustomScores({}); 
      setPart2BreakdownScores({});
      if (selectedMatchData && selectedPartKey) { // Only set loading to false if we expected data
          setLoadingDetails(false);
      }
      return;
    }
    
    setLoadingDetails(true); // Moved here
    const partConfig = PART_DEFINITIONS[selectedPartKey];
    const scoresDataRoot = selectedMatchData.scores?.[partConfig.scorePath];
    const answersDataRoot = selectedPartKey === 'part_2' ? selectedMatchData.answers?.[partConfig.scorePath] : null;
    const questionDataRoot = selectedMatchData[partConfig.questionDataPath];

    if (partConfig.manualOnly) {
      const fetchedCustomScores = selectedMatchData.scores?.[partConfig.scorePath]?.custom_scores || {};
      const fetchedBreakdownScores = selectedMatchData.scores?.[partConfig.scorePath]?.custom_breakdown || {};
      const manualTotals = teamsInMatch.reduce((acc, team) => {
        const teamBreakdown = fetchedBreakdownScores[team.id] || {};
        const online = Number(teamBreakdown.online || 0);
        const presentation = Number(teamBreakdown.presentation || 0);
        const total = Number(
          teamBreakdown.total !== undefined
            ? teamBreakdown.total
            : (Number(fetchedCustomScores[team.id] || 0) || online + presentation)
        );
        acc[team.id] = total;
        return acc;
      }, {});

      setDetailedScores([]);
      setCustomScores(fetchedCustomScores);
      setPart2BreakdownScores(
        teamsInMatch.reduce((acc, team) => {
          const teamBreakdown = fetchedBreakdownScores[team.id] || {};
          const online = Number(teamBreakdown.online || 0);
          const presentation = Number(teamBreakdown.presentation || 0);
          const total = Number(
            teamBreakdown.total !== undefined
              ? teamBreakdown.total
              : (Number(fetchedCustomScores[team.id] || 0) || online + presentation)
          );
          acc[team.id] = { online, presentation, total };
          return acc;
        }, {})
      );
      setTeamPartTotals(manualTotals);
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
    
    const processData = async () => { // Renamed from IIFE for clarity
      const processedScores = [];
      const questionBasedTeamTotals = teamsInMatch.reduce((acc, team) => ({...acc, [team.id]: 0}), {});

      if (partConfig.hasPackages) { // Part 1 and Part 3
        Object.entries(questionDataRoot).forEach(([packageId, packageContent]) => {
          // Check if packageContent is an object and has questions
          if (typeof packageContent !== 'object' || packageContent === null) return;
          const questionsInPackage = Object.keys(packageContent).filter(k => k.startsWith('question_'));
          
          questionsInPackage.forEach(questionKey => {
            const questionInfo = packageContent[questionKey];
            if (typeof questionInfo !== 'object' || questionInfo === null) return;

            const row = {
              key: `${packageId}-${questionKey}`,
              package: packageContent.name || packageId.replace('package_', 'Gói '),
              questionNum: questionInfo?.question_num || questionKey.split('_')[1],
              questionText: questionInfo?.question || questionInfo?.question_text,
            };
            teamsInMatch.forEach(team => {
              const scoreEntry = scoresDataRoot?.[packageId]?.[questionKey];
              let score = 0;
              let answeredByThisTeam = false;
              if (scoreEntry && scoreEntry.team_id === team.id) {
                score = scoreEntry.score === null || scoreEntry.score === undefined ? 0 : Number(scoreEntry.score);
                answeredByThisTeam = true;
              }
              row[team.id] = score;
              row[`${team.id}_answered`] = answeredByThisTeam;
              questionBasedTeamTotals[team.id] += score;
            });
            processedScores.push(row);
          });
        });
      } else { // Part 2
        Object.entries(questionDataRoot).forEach(([questionKey, questionInfo]) => {
           if (typeof questionInfo !== 'object' || questionInfo === null) return;
          const row = {
            key: questionKey,
            package: '-', 
            questionNum: questionInfo?.question_num || questionKey.split('_')[1],
            questionText: questionInfo?.question,
          };
          teamsInMatch.forEach(team => {
            const scoreEntry = scoresDataRoot?.[questionKey]?.[team.id];
            const answerEntry = answersDataRoot?.[questionKey]?.[team.id];
            let score = 0;
            let choice = '-';
            let answeredByThisTeam = false;

            if (scoreEntry && typeof scoreEntry === 'object') { // Ensure scoreEntry is an object
              score = scoreEntry.score === null || scoreEntry.score === undefined ? 0 : Number(scoreEntry.score);
              choice = scoreEntry.choice || '-'; 
              answeredByThisTeam = true; 
            } else if (answerEntry && typeof answerEntry === 'object') { 
              choice = answerEntry.choice || '-';
              answeredByThisTeam = true; 
            }
            
            row[team.id] = score;
            row[`${team.id}_choice`] = choice;
            row[`${team.id}_answered`] = answeredByThisTeam;
            questionBasedTeamTotals[team.id] += score;
          });
          processedScores.push(row);
        });
      }

      const roundKeyForCustom = partConfig.scorePath; 
      let fetchedCustomScores = selectedMatchData.scores?.[roundKeyForCustom]?.custom_scores || {};
      // No need to fetch custom scores separately if selectedMatchData is real-time
      setCustomScores(fetchedCustomScores);

      const finalTeamTotals = {};
      teamsInMatch.forEach(team => {
        finalTeamTotals[team.id] = (questionBasedTeamTotals[team.id] || 0) + (Number(fetchedCustomScores[team.id]) || 0);
      });
      setTeamPartTotals(finalTeamTotals);
      
      let finalDetailedScores = processedScores;
      if (hideUnanswered) {
          finalDetailedScores = processedScores.filter(row => {
              return teamsInMatch.some(team => row[`${team.id}_answered`]);
          });
      }

      setDetailedScores(finalDetailedScores.sort((a,b) => {
          if(a.package && b.package && a.package.localeCompare(b.package) !== 0) return a.package.localeCompare(b.package);
          return parseInt(a.questionNum) - parseInt(b.questionNum);
      }));
      setLoadingDetails(false); // Set loading to false after processing
    };

    processData();

  }, [selectedMatchData, selectedPartKey, teamsInMatch, hideUnanswered]); // Removed selectedMatchId as selectedMatchData covers it


  const handleMatchChange = (matchId) => {
    setSelectedMatchId(matchId); // This will trigger the useEffect for selectedMatchData
    // Reset part-specific states
    setSelectedPartKey(null); 
    setDetailedScores([]);
    setTeamPartTotals({});
    setCustomScores({});
    setPart2BreakdownScores({});
    setHideUnanswered(false);
  };

  const handlePartChange = (partKey) => {
    setSelectedPartKey(partKey);
    // Reset custom scores and totals when part changes, as they are part-specific
    setCustomScores({});
    setPart2BreakdownScores({});
    setTeamPartTotals({});
     // Data will be re-fetched by the main useEffect
  };

  const handleScoreUpdate = async (recordKey, teamId, newScoreValue) => {
    if (!selectedMatchId || !selectedPartKey || !selectedMatchData) return; // Added selectedMatchData check

    const finalScore = newScoreValue === null || newScoreValue === undefined ? 0 : Number(newScoreValue);

    const partConfig = PART_DEFINITIONS[selectedPartKey];
    const roundKey = partConfig.scorePath; // e.g. round_1

    const [packageIdOrQuestionId, questionKeyOrNull] = recordKey.split('-');
    
    let scorePathFirebase = `matches/${selectedMatchId}/scores/${roundKey}/`;
    const updatedMatchDataLocalCopy = JSON.parse(JSON.stringify(selectedMatchData)); 

    if (!updatedMatchDataLocalCopy.scores) updatedMatchDataLocalCopy.scores = {};
    if (!updatedMatchDataLocalCopy.scores[roundKey]) updatedMatchDataLocalCopy.scores[roundKey] = {};

    if (partConfig.hasPackages) { // Part 1 & 3
        const actualPackageId = packageIdOrQuestionId;
        const actualQuestionKey = questionKeyOrNull;
        scorePathFirebase += `${actualPackageId}/${actualQuestionKey}`;
        
        const teamInfo = teamsInMatch.find(t => t.id === teamId);
        const scoreDataToSet = {
            team_id: teamId,
            team_name: teamInfo?.name || teamId,
            score: finalScore,
            timestamp: serverTimestamp()
        };
        try {
            await set(ref(database, scorePathFirebase), scoreDataToSet);
            message.success('Điểm cập nhật thành công!');
            
            if (!updatedMatchDataLocalCopy.scores[roundKey][actualPackageId]) updatedMatchDataLocalCopy.scores[roundKey][actualPackageId] = {};
            updatedMatchDataLocalCopy.scores[roundKey][actualPackageId][actualQuestionKey] = { 
                ...scoreDataToSet, 
                timestamp: Date.now() // Local timestamp for optimistic update
            };
            setSelectedMatchData(updatedMatchDataLocalCopy);
        } catch (error) {
            message.error('Lỗi cập nhật điểm: ' + error.message);
        }

    } else { // Part 2
        const actualQuestionKey = packageIdOrQuestionId;
        // For Part 2, the score object might contain more than just score, like 'choice'.
        // We are updating the 'score' field specifically.
        const currentTeamScoreDataPath = `matches/${selectedMatchId}/scores/${roundKey}/${actualQuestionKey}/${teamId}`;
        const scoreDataRef = ref(database, currentTeamScoreDataPath);

        try {
            const snapshot = await get(scoreDataRef);
            let existingData = {};
            if (snapshot.exists()) {
                existingData = snapshot.val();
            }
            
            const dataToSet = {
                ...existingData, // Preserve other fields like 'choice', 'team_name'
                score: finalScore,
                team_id: teamId, // Ensure team_id and team_name are present
                team_name: teamsInMatch.find(t => t.id === teamId)?.name || teamId,
                timestamp: serverTimestamp() // Update timestamp on score change
            };
            
            await set(scoreDataRef, dataToSet);
            message.success('Điểm cập nhật thành công!');

            if (!updatedMatchDataLocalCopy.scores[roundKey][actualQuestionKey]) updatedMatchDataLocalCopy.scores[roundKey][actualQuestionKey] = {};
            updatedMatchDataLocalCopy.scores[roundKey][actualQuestionKey][teamId] = {
                ...dataToSet,
                timestamp: Date.now() // Local timestamp for optimistic update
            };
            setSelectedMatchData(updatedMatchDataLocalCopy);
        } catch (error) {
            message.error('Lỗi cập nhật điểm: ' + error.message);
        }
    }
  };

  const handleCustomScoreUpdate = async (teamId, newCustomScoreValue) => {
    if (!selectedMatchId || !selectedPartKey || !selectedMatchData) return; // Added selectedMatchData check
    
    const scoreValue = newCustomScoreValue === null || newCustomScoreValue === undefined ? 0 : Number(newCustomScoreValue);

    const partConfig = PART_DEFINITIONS[selectedPartKey];
    const roundKey = partConfig.scorePath;
    const customScorePath = `matches/${selectedMatchId}/scores/${roundKey}/custom_scores/${teamId}`;

    try {
        await set(ref(database, customScorePath), scoreValue);
        message.success(`Điểm tùy chỉnh cho đội ${teamsInMatch.find(t => t.id === teamId)?.name} cập nhật.`);
        // OPTIONAL: Optimistic update for customScores state if desired for instant UI feedback
        // The main selectedMatchData listener will eventually update it.
        // setCustomScores(prev => ({ ...prev, [teamId]: scoreValue }));
    } catch (error) {
        message.error('Lỗi cập nhật điểm tùy chỉnh: ' + error.message);
    }
  };

  const handlePart2BreakdownUpdate = async (teamId, field, rawValue) => {
    if (!selectedMatchId || selectedPartKey !== 'part_2' || !selectedMatchData) return;

    const safeValue = rawValue === null || rawValue === undefined ? 0 : Number(rawValue);
    const previousBreakdown = part2BreakdownScores[teamId] || emptyPart2Breakdown;
    const nextBreakdown = {
      ...previousBreakdown,
      [field]: safeValue,
    };
    nextBreakdown.total = Number(nextBreakdown.online || 0) + Number(nextBreakdown.presentation || 0);

    try {
      await set(ref(database, `matches/${selectedMatchId}/scores/round_2/custom_breakdown/${teamId}`), nextBreakdown);
      await set(ref(database, `matches/${selectedMatchId}/scores/round_2/custom_scores/${teamId}`), nextBreakdown.total);
      message.success(`Điểm phần 2 cho đội ${teamsInMatch.find(t => t.id === teamId)?.name} đã cập nhật.`);
    } catch (error) {
      message.error('Lỗi cập nhật điểm phần 2: ' + error.message);
    }
  };


  const tableColumns = [
    { title: 'Gói/Câu hỏi', dataIndex: 'package', key: 'package', width: 150, fixed: 'left' },
    { title: 'STT', dataIndex: 'questionNum', key: 'questionNum', width: 80, fixed: 'left' },
    // Dynamically add team columns
    ...teamsInMatch.map(team => ({
      title: team.name,
      dataIndex: team.id,
      key: team.id,
      width: 150,
      render: (score, record) => {
        const answered = record[`${team.id}_answered`];
        const choice = selectedPartKey === 'part_2' ? record[`${team.id}_choice`] : null;
        // Ensure score is a number for InputNumber, default to 0 if undefined/null
        const displayScore = score === null || score === undefined ? 0 : Number(score);
        return (
          <Space direction="vertical" style={{width: '100%'}}>
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
     { title: 'Nội dung câu hỏi', dataIndex: 'questionText', key: 'questionText', width: 300, ellipsis: true},
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
          {allMatches.map(match => (
            <Option key={match.id} value={match.id}>{match.title}</Option>
          ))}
        </Select>
        {selectedMatchId && (
          <Select
            style={{ width: 250 }}
            placeholder="Chọn phần thi"
            onChange={handlePartChange}
            value={selectedPartKey}
          >
            {Object.entries(PART_DEFINITIONS).map(([key, val]) => (
              <Option key={key} value={key}>{val.name}</Option>
            ))}
          </Select>
        )}
      </Space>

      {selectedMatchId && selectedPartKey && teamsInMatch.length > 0 && (
        <>
          <div style={{ marginBottom: 16, marginTop: 16 }}>
            <Title level={4}>Tổng điểm {PART_DEFINITIONS[selectedPartKey]?.name}:</Title>
            <Space wrap>
                {teamsInMatch.map(team => (
                    <Tag color="blue" key={team.id} style={{fontSize: '16px', padding: '5px 10px', marginBottom: '5px'}}>
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
                  {teamsInMatch.map(team => {
                    const breakdown = part2BreakdownScores[team.id] || emptyPart2Breakdown;
                    return (
                      <Space
                        key={`part2_breakdown_${team.id}`}
                        align="center"
                        wrap
                        style={{ marginBottom: 4 }}
                      >
                        <Text style={{ minWidth: '150px' }}>{team.name}:</Text>
                        <Space align="center">
                          <Text>Trực tuyến (40%)</Text>
                          <InputNumber
                            min={0}
                            max={40}
                            value={breakdown.online}
                            onChange={(value) => handlePart2BreakdownUpdate(team.id, 'online', value)}
                            style={{ width: 90 }}
                          />
                        </Space>
                        <Space align="center">
                          <Text>Thuyết minh (60%)</Text>
                          <InputNumber
                            min={0}
                            max={60}
                            value={breakdown.presentation}
                            onChange={(value) => handlePart2BreakdownUpdate(team.id, 'presentation', value)}
                            style={{ width: 90 }}
                          />
                        </Space>
                        <Tag color="blue" style={{ fontSize: '14px', padding: '4px 10px', marginInlineStart: 8 }}>
                          Tổng: {breakdown.total}/100
                        </Tag>
                      </Space>
                    );
                  })}
                </Space>
              </>
            ) : (
              <>
                <Title level={5}>Điểm Thưởng/Phụ cho {PART_DEFINITIONS[selectedPartKey]?.name}:</Title>
                <Space wrap>
                  {teamsInMatch.map(team => (
                    <Space key={`custom_${team.id}`} align="center" style={{ marginRight: 15, marginBottom: 10}}>
                      <Text style={{ minWidth: '100px', textAlign: 'right'}}>{team.name}:</Text>
                      <InputNumber
                        value={customScores[team.id] || 0}
                        onChange={(value) => handleCustomScoreUpdate(team.id, value)}
                        placeholder="Điểm"
                        style={{width: 80}}
                      />
                    </Space>
                  ))}
                </Space>
              </>
            )}
          </div>
          
          {!PART_DEFINITIONS[selectedPartKey]?.manualOnly && (
            <Space style={{ marginBottom: 16}}>
              <Text>Ẩn câu hỏi chưa có đội trả lời/ghi điểm:</Text>
              <Switch checked={hideUnanswered} onChange={setHideUnanswered} />
            </Space>
          )}

          {PART_DEFINITIONS[selectedPartKey]?.manualOnly && (
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              {selectedPartKey === 'part_2'
                ? 'Phần 2 chấm theo 2 thành phần: Trực tuyến 40% và Thuyết minh 60%. Hệ thống sẽ tự cộng thành tổng điểm 100%.'
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
          scroll={{ x: 1300 }} // Enable horizontal scroll if many teams
          pagination={{ pageSize: 20 }}
        />
      )}
    </div>
  );
}

export default ScoresPage; 
