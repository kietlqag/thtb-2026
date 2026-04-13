import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Spin, Typography, Row, Col } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { ref, onValue, off, get } from 'firebase/database';
import { database } from '../../services/firebase/config';
import contestBackground from '../../assets/images/contest_background.png';

const { Title, Text } = Typography;

const normalizePart2Breakdown = (rawBreakdown = {}, fallbackTotal = 0) => {
  const hasExplicitOnlineRaw = rawBreakdown.onlineRaw !== undefined && rawBreakdown.onlineRaw !== null;
  const onlineRaw = hasExplicitOnlineRaw
    ? Number(rawBreakdown.onlineRaw || 0)
    : Number((Number(rawBreakdown.online || 0) / 0.4).toFixed(2));
  const onlineWeighted = Number((onlineRaw * 0.4).toFixed(2));
  const presentation = Number(rawBreakdown.presentation || 0);
  const total = Number(
    rawBreakdown.total !== undefined
      ? rawBreakdown.total
      : (fallbackTotal || onlineWeighted + presentation || 0)
  );

  return {
    online: onlineWeighted,
    onlineRaw,
    onlineWeighted,
    presentation,
    total: Number(total.toFixed(2)),
  };
};

const PART_INFO_MAP = {
  part1: { name: "PHẦN THI 1: TIÊN PHONG", roundKey: 'round_1' },
  part2: { name: "PHẦN THI 2: KHÁT VỌNG", roundKey: 'round_2' },
  part3: { name: "PHẦN THI 3: TỰ HÀO TIẾN BƯỚC", roundKey: 'round_3' },
};

const PartScoreboard = () => {
  const { matchId, partKey } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState([]);
  const [partScores, setPartScores] = useState({});
  const [part2BreakdownScores, setPart2BreakdownScores] = useState({});
  const [currentPartDisplayName, setCurrentPartDisplayName] = useState('');

  const teamCount = teams.length;

  useEffect(() => {
    if (!matchId || !partKey || !PART_INFO_MAP[partKey]) {
      navigate(`/organizer/contest/${matchId || ''}`);
      return;
    }
    setCurrentPartDisplayName(PART_INFO_MAP[partKey].name);
    setLoading(true);

    const matchRef = ref(database, `matches/${matchId}`);
    const listener = onValue(matchRef, async (snapshot) => {
      if (snapshot.exists()) {
        const matchData = snapshot.val();
        const teamDetails = [];
        if (matchData.team_ids && Array.isArray(matchData.team_ids)) {
          for (const teamId of matchData.team_ids) {
            const teamSnapshot = await get(ref(database, `teams/${teamId}`));
            teamDetails.push({
              id: teamId,
              name: teamSnapshot.exists() ? teamSnapshot.val().name : `Đội ${teamId}`,
            });
          }
        }

        let displayTeams = teamDetails;
        if (partKey === 'part3') {
          const prelimTotals = teamDetails.reduce((acc, team) => {
            acc[team.id] = 0;
            return acc;
          }, {});

          const round1Scores = matchData.scores?.round_1 || {};
          Object.values(round1Scores).forEach((packageData) => {
            if (typeof packageData !== 'object' || packageData === null) return;
            Object.values(packageData).forEach((questionScore) => {
              if (questionScore?.team_id && prelimTotals[questionScore.team_id] !== undefined) {
                prelimTotals[questionScore.team_id] += Number(questionScore.score || 0);
              }
            });
          });

          const round2Scores = matchData.scores?.round_2?.custom_scores || {};
          Object.entries(round2Scores).forEach(([teamId, score]) => {
            if (prelimTotals[teamId] !== undefined) {
              prelimTotals[teamId] += Number(score || 0);
            }
          });

          displayTeams = [...teamDetails]
            .sort((a, b) => {
              const diff = (prelimTotals[b.id] || 0) - (prelimTotals[a.id] || 0);
              if (diff !== 0) return diff;
              return a.name.localeCompare(b.name, 'vi');
            })
            .slice(0, 4);
        }

        setTeams(displayTeams);

        const calculatedScores = {};
        displayTeams.forEach(team => (calculatedScores[team.id] = 0));
        const nextPart2BreakdownScores = {};

        const roundKey = PART_INFO_MAP[partKey].roundKey;
        const roundScoresData = matchData.scores?.[roundKey] || {};

        if (roundScoresData.custom_scores) {
          Object.entries(roundScoresData.custom_scores).forEach(([teamId, score]) => {
            if (calculatedScores[teamId] !== undefined) {
              calculatedScores[teamId] += Number(score || 0);
            }
          });
        }

        if (partKey === 'part2') {
          displayTeams.forEach((team) => {
            const total = Number(roundScoresData.custom_scores?.[team.id] || 0);
            nextPart2BreakdownScores[team.id] = { total };
            calculatedScores[team.id] = total;
          });
        }
        
        Object.entries(roundScoresData).forEach(([itemId, itemData]) => {
          if (itemId === 'custom_scores' || itemId === 'custom_breakdown') return;

          if (partKey === 'part1' || partKey === 'part3') {
            if (typeof itemData === 'object' && itemData !== null) {
              Object.values(itemData).forEach(questionScore => {
                if (questionScore && questionScore.team_id && calculatedScores[questionScore.team_id] !== undefined) {
                  calculatedScores[questionScore.team_id] += Number(questionScore.score || 0);
                }
              });
            }
          } else if (partKey === 'part2') {
            // Part 2 is scored manually in Admin via custom_scores only.
            return;
          }
        });
        setPart2BreakdownScores(nextPart2BreakdownScores);
        setPartScores(calculatedScores);
      } else {
        navigate(`/organizer`);
      }
      setLoading(false);
    }, (error) => {
      console.error("PartScoreboard: Firebase read failed:", error);
      setLoading(false);
      navigate(`/organizer`);
    });

    return () => off(matchRef, 'value', listener);
  }, [matchId, partKey, navigate]);

  // Define styles locally
  const headerBackgroundColor = '#d13c30'; // Color from the provided ContestPart1.jsx style

  const pageContainerStyle = {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  const contentAreaStyle = {
    flexGrow: 1,
    padding: '15px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  };

  const mainHeaderStyle = {
    width: '100%',
    backgroundColor: headerBackgroundColor,
    minHeight: '80px',
    padding: '10px 30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
    position: 'relative', 
    zIndex: 20,
    color: 'white',
  };

  const headerTitleStyle = {
    margin: 0,
    color: 'white',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontSize: 'clamp(20px, 3.5vw, 36px)',
    fontWeight: 'bold',
    textAlign: 'center',
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)',
  };

  const controlButtonBaseStyle = {
    width: '50px',
    height: '50px',
    fontSize: '18px',
    fontWeight: 'bold',
    border: `2px solid white`,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    color: 'white',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 0px 10px rgba(255, 255, 255, 0.3)',
    borderRadius: '8px',
    padding: 0,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  const teamNameCellStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    border: `3px solid ${headerBackgroundColor}`,
    borderRadius: '12px',
    margin: '10px 5px 5px 5px',
    padding: '10px',
    fontWeight: 'bold',
    fontSize: 'clamp(1.3rem, 2.2vw, 1.7rem)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)', 
    color: headerBackgroundColor,
    textAlign: 'center',
    lineHeight: '1.3',
    flexBasis: '20%',
    overflow: 'hidden',
  };

  const scoreBoxCellStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    border: `3px solid ${headerBackgroundColor}`,
    borderRadius: '12px',
    margin: '0px 5px 10px 5px',
    padding: '10px',
    flexBasis: '70%',
    fontWeight: 'bold',
    fontSize: 'clamp(3rem, 9vw, 5.5rem)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    color: headerBackgroundColor,
  };

  const part2ScoreStackStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    margin: '0px 5px 10px 5px',
    flexBasis: '70%',
  };

  const part2ScoreRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    border: `3px solid ${headerBackgroundColor}`,
    borderRadius: '12px',
    padding: '10px 14px',
    minHeight: '74px',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    color: headerBackgroundColor,
  };

  const part2ScoreLabelStyle = {
    fontSize: 'clamp(1rem, 1.4vw, 1.2rem)',
    fontWeight: 'bold',
  };

  const part2ScoreValueStyle = {
    fontSize: 'clamp(2rem, 4.5vw, 3.4rem)',
    fontWeight: 'bold',
    lineHeight: 1,
  };

  const getTeamColumnProps = () => {
    if (teamCount <= 2) return { xs: 24, sm: 12, md: 12, lg: 12 };
    if (teamCount === 3) return { xs: 24, sm: 12, md: 8, lg: 8 };
    return { xs: 12, sm: 12, md: 6, lg: 6 };
  };

  const teamColumnProps = getTeamColumnProps();

  if (loading) {
    return (
      <div style={{ 
        ...pageContainerStyle, 
        backgroundImage: `url(${contestBackground})`, 
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        padding: 0,
      }}>
        <Spin size="large" tip="Đang tải điểm phần thi..." />
      </div>
    );
  }

  return (
    <div style={{
      ...pageContainerStyle,
      backgroundImage: `url(${contestBackground})`,
    }}>
      <div style={{
        ...mainHeaderStyle,
      }}>
        <Title level={2} style={{
          ...headerTitleStyle,
        }}>
          {currentPartDisplayName}
        </Title>
      </div>

      <div style={contentAreaStyle}>
        <Row 
          gutter={[15, 15]} 
          justify="center" 
          align="stretch"
          style={{ 
            width: '100%', 
            maxWidth: '1550px', 
            margin: '0 auto',
            flexGrow: 1,
            display: 'flex',
          }}>
          {teams.map(team => (
            <Col 
              {...teamColumnProps}
              key={team.id} 
              style={{ 
                display: 'flex', 
                flexDirection: 'column',
              }}
            >
            <div style={teamNameCellStyle}>
                <Text style={{color: teamNameCellStyle.color, fontSize: 'inherit', fontWeight: 'bold', lineHeight: 'inherit'}}> 
                  {team.name}
                </Text>
            </div>
            {partKey === 'part2' ? (
              <div style={part2ScoreStackStyle}>
                <div style={part2ScoreRowStyle}>
                  <Text style={part2ScoreLabelStyle}>Tổng 100%</Text>
                  <Text style={part2ScoreValueStyle}>{part2BreakdownScores[team.id]?.total || 0}</Text>
                </div>
              </div>
            ) : (
              <div style={scoreBoxCellStyle}>
                {partScores[team.id] !== undefined ? partScores[team.id] : 0}
              </div>
            )}
          </Col>
        ))}
      </Row>
      </div>

      <div style={{
          position: 'absolute',
          bottom: '30px',
          left: '30px',
          zIndex: 1000, 
      }}>
          <Button
              icon={<ArrowLeftOutlined />}
              style={controlButtonBaseStyle}
              onClick={() => navigate(`/organizer/contest/${matchId}/${partKey}`)}
              title="Về lại phần thi"
          />
      </div>
    </div>
  );
};

export default PartScoreboard; 
