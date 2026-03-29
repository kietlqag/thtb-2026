import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Spin, Typography, Row, Col } from 'antd';
import { ArrowLeftOutlined, TrophyOutlined } from '@ant-design/icons';
import { ref, onValue, off, get } from 'firebase/database';
import { database } from '../../services/firebase/config';
import contestBackground from '../../assets/images/contest_background.png';

const { Title, Text } = Typography;

const FullScreenScoreboard = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [matchTitle, setMatchTitle] = useState('TỔNG ĐIỂM'); // Default title
  const [teams, setTeams] = useState([]); // [{ id, name }]
  const [scores, setScores] = useState({}); // { teamId: { part1: 0, part2: 0, part3: 0, total: 0 } }
  const [showAwardBadges, setShowAwardBadges] = useState(false);

  useEffect(() => {
    if (!matchId) {
      navigate('/organizer');
      return;
    }

    setLoading(true);
    const matchRef = ref(database, `matches/${matchId}`);

    const listener = onValue(matchRef, async (snapshot) => {
      if (snapshot.exists()) {
        const matchData = snapshot.val();
        // setMatchTitle(matchData.title || 'Tổng Điểm'); // Title is fixed to TỔNG ĐIỂM for this screen

        const teamDetails = [];
        if (matchData.team_ids && Array.isArray(matchData.team_ids)) {
          for (const teamId of matchData.team_ids) {
            const teamSnapshot = await get(ref(database, `teams/${teamId}`));
            if (teamSnapshot.exists()) {
              teamDetails.push({ id: teamId, name: teamSnapshot.val().name || `Đội ${teamId}` });
            } else {
              teamDetails.push({ id: teamId, name: `Đội ${teamId}` });
            }
          }
        }
        setTeams(teamDetails);

        const calculatedScores = {};
        teamDetails.forEach(team => {
          calculatedScores[team.id] = { part1: 0, part2: 0, part3: 0, total: 0 };
        });

        const allScoresData = matchData.scores || {};

        // Part 1 Scores
        const scoresR1 = allScoresData.round_1 || {};
        if (scoresR1) {
          if (scoresR1.custom_scores) {
            Object.entries(scoresR1.custom_scores).forEach(([teamId, scoreVal]) => {
              if(calculatedScores[teamId]) calculatedScores[teamId].part1 += Number(scoreVal || 0);
          });
          }
          Object.values(scoresR1).forEach(packageData => {
            if (typeof packageData === 'object' && packageData !== null && packageData !== scoresR1.custom_scores) {
                 Object.values(packageData).forEach(questionScore => {
                    if (questionScore && questionScore.team_id && calculatedScores[questionScore.team_id]) {
                        calculatedScores[questionScore.team_id].part1 += Number(questionScore.score || 0);
                    }
                });
            }
          });
        }

        // Part 2 Scores
        const scoresR2 = allScoresData.round_2 || {};
        if (scoresR2?.custom_scores) {
          Object.entries(scoresR2.custom_scores).forEach(([teamId, scoreVal]) => {
            if (calculatedScores[teamId]) {
              calculatedScores[teamId].part2 += Number(scoreVal || 0);
            }
          });
        }
        
        // Part 3 Scores
        const scoresR3 = allScoresData.round_3 || {};
        if (scoresR3) {
            if (scoresR3.custom_scores) {
                Object.entries(scoresR3.custom_scores).forEach(([teamId, scoreVal]) => {
                    if(calculatedScores[teamId]) calculatedScores[teamId].part3 += Number(scoreVal || 0);
            });
            }
             Object.values(scoresR3).forEach(packageData => {
                if (typeof packageData === 'object' && packageData !== null && packageData !== scoresR3.custom_scores) {
                    Object.values(packageData).forEach(questionScore => {
                        if (questionScore && questionScore.team_id && calculatedScores[questionScore.team_id]) {
                            calculatedScores[questionScore.team_id].part3 += Number(questionScore.score || 0);
                        }
                    });
                }
            });
        }

        // Calculate totals
        Object.keys(calculatedScores).forEach(teamId => {
          calculatedScores[teamId].total =
            (calculatedScores[teamId].part1 || 0) +
            (calculatedScores[teamId].part2 || 0) +
            (calculatedScores[teamId].part3 || 0);
        });

        const sortedTeams = [...teamDetails].sort((a, b) => {
          const totalDiff = (calculatedScores[b.id]?.total || 0) - (calculatedScores[a.id]?.total || 0);
          if (totalDiff !== 0) return totalDiff;

          const part3Diff = (calculatedScores[b.id]?.part3 || 0) - (calculatedScores[a.id]?.part3 || 0);
          if (part3Diff !== 0) return part3Diff;

          const part2Diff = (calculatedScores[b.id]?.part2 || 0) - (calculatedScores[a.id]?.part2 || 0);
          if (part2Diff !== 0) return part2Diff;

          const part1Diff = (calculatedScores[b.id]?.part1 || 0) - (calculatedScores[a.id]?.part1 || 0);
          if (part1Diff !== 0) return part1Diff;

          return a.name.localeCompare(b.name, 'vi');
        });
        
        setScores(calculatedScores);
        setTeams(sortedTeams);

      } else {
        console.error("FullScreenScoreboard: Không tìm thấy dữ liệu trận đấu ID:", matchId);
        navigate('/organizer', { replace: true, state: { error: "Không tìm thấy trận đấu" } });
      }
      setLoading(false);
    }, (error) => {
      console.error("FullScreenScoreboard: Firebase read failed:", error);
      setLoading(false);
      navigate('/organizer', { replace: true, state: { error: "Lỗi tải dữ liệu trận đấu" } });
    });

    return () => off(matchRef, 'value', listener);
  }, [matchId, navigate]);

  // Define styles locally (inspired by PartScoreboard.jsx)
  const headerBackgroundColor = '#d13c30';

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
    padding: '10px 14px 72px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  };

  const mainHeaderStyle = {
    width: '100%',
    backgroundColor: headerBackgroundColor,
    minHeight: '68px',
    padding: '8px 24px',
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
    fontSize: 'clamp(20px, 3vw, 32px)',
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

  const activeControlButtonStyle = {
    ...controlButtonBaseStyle,
    borderColor: '#FFD700',
    color: '#FFD700',
    backgroundColor: 'rgba(80, 60, 0, 0.45)',
  };

  const teamColumnStyle = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%', // Assumes parent Row has align="stretch" or fixed height
    justifyContent: 'space-between',
  };
  
  const teamNameBoxStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    border: `3px solid ${headerBackgroundColor}`,
    borderRadius: '12px',
    margin: '4px 0',
    padding: '4px 10px',
    fontWeight: 'bold',
    fontSize: 'clamp(1rem, 1.5vw, 1.28rem)',
    backgroundColor: 'white',
    color: headerBackgroundColor,
    textAlign: 'center',
    lineHeight: '1.3',
    minHeight: '50px',
    height: '18%',
    overflow: 'hidden', // Keep this to clip excess
  };

  const scoreEntryBoxStyle = {
    display: 'flex',
    justifyContent: 'space-between', // For Label and Value
    alignItems: 'center',
    border: `3px solid ${headerBackgroundColor}`,
    borderRadius: '12px',
    margin: '4px 0',
    padding: '6px 10px',
    fontWeight: 'bold',
    backgroundColor: 'rgba(255, 255, 255, 1)',
    color: headerBackgroundColor,
    minHeight: '46px',
    height: '16%',
  };
  
  const scoreLabelStyle = {
    fontSize: 'clamp(0.82rem, 1.1vw, 0.98rem)',
    opacity: 0.9,
  };

  const scoreValueStyle = {
    fontSize: 'clamp(1.1rem, 1.9vw, 1.6rem)',
    fontWeight: 'bold',
  };
  
  const totalScoreBoxStyle = {
    ...scoreEntryBoxStyle,
    height: '18%',
    // backgroundColor: '#f0f0f0', // Slightly different background for total
  };

  const totalScoreLabelStyle = {
    ...scoreLabelStyle,
    fontWeight: 'bold',
  };
  
  const totalScoreValueStyle = {
    ...scoreValueStyle,
    fontSize: 'clamp(1.45rem, 2.4vw, 2.25rem)',
    color: headerBackgroundColor, // Keep color consistent or make it pop more if needed
  };

  const consolationBadgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 10px',
    borderRadius: '999px',
    backgroundColor: 'rgba(209, 60, 48, 0.12)',
    color: headerBackgroundColor,
    fontSize: 'clamp(0.72rem, 0.95vw, 0.82rem)',
    fontWeight: 'bold',
    marginTop: '6px',
    whiteSpace: 'nowrap',
  };

  const getRankBadge = (index, teamCount) => {
    if (index === 0) {
      return {
        label: 'Giải nhất',
        color: '#b77900',
        backgroundColor: 'rgba(255, 193, 7, 0.22)',
      };
    }
    if (index === 1) {
      return {
        label: 'Giải nhì',
        color: '#4f5b66',
        backgroundColor: 'rgba(203, 213, 225, 0.5)',
      };
    }
    if (index === 2 || index === 3) {
      return {
        label: 'Giải ba',
        color: '#8a4b1f',
        backgroundColor: 'rgba(205, 127, 50, 0.2)',
      };
    }
    if (index >= Math.max(teamCount - 3, 0)) {
      return {
        label: 'Giải khuyến khích',
        color: headerBackgroundColor,
        backgroundColor: 'rgba(209, 60, 48, 0.12)',
      };
    }
    return null;
  };

  if (loading) {
    return (
      <div style={{ 
        ...pageContainerStyle, 
        backgroundImage: `url(${contestBackground})`, 
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        padding: 0, // Override padding for centered spin
      }}>
        <Spin size="large" tip="Đang tải bảng tổng điểm..." />
      </div>
    );
  }

  return (
    <div style={{
      ...pageContainerStyle,
      backgroundImage: `url(${contestBackground})`,
    }}>
      <div style={mainHeaderStyle}>
        <Title level={2} style={headerTitleStyle}>
          {matchTitle}
        </Title>
      </div>

      <div style={{...contentAreaStyle, justifyContent: 'center', alignItems: 'center' }}>
        <Row 
          gutter={[12, 12]}
          justify="center" 
          align="stretch" // Stretch columns to be of equal height
          style={{ 
            width: '100%', 
            maxWidth: '1550px', 
            margin: '0 auto',
            flexGrow: 1, // Allow row to take available space
            maxHeight: 'calc(100vh - 68px - 72px)',
          }}
        >
          
          {teams.map((team, index) => {
            const isConsolationTeam = index >= Math.max(teams.length - 3, 0);
            const rankBadge = getRankBadge(index, teams.length);
            const part3BoxStyle = isConsolationTeam
              ? {
                  ...scoreEntryBoxStyle,
                  opacity: 0.5,
                  backgroundColor: 'rgba(255, 255, 255, 0.72)',
                }
              : scoreEntryBoxStyle;
            const part3ValueStyle = isConsolationTeam
              ? { ...scoreValueStyle, opacity: 0.55 }
              : scoreValueStyle;
            const part3LabelStyle = isConsolationTeam
              ? { ...scoreLabelStyle, opacity: 0.6 }
              : scoreLabelStyle;

            return (
            <Col 
              xs={12} sm={12} md={6} // Show 2 teams on small, 4 on medium+
              key={team.id} 
              style={{ display: 'flex', flexDirection: 'column' }} // Ensure Col itself is a flex container for height distribution
            >
              <div style={teamColumnStyle}> {/* Inner container for flex distribution of boxes */}
                <div style={{
                  ...teamNameBoxStyle,
                  flexDirection: 'column',
                }}>
                  <Text style={{
                     color: 'inherit', 
                     fontSize: 'inherit', 
                     fontWeight: 'inherit', 
                     lineHeight: 'inherit',
                     whiteSpace: 'normal', // Allow text to wrap
                     textAlign: 'center', // Ensure wrapped text is centered
                  }}> 
                    {team.name}
                  </Text>
                  {showAwardBadges && rankBadge && (
                    <span style={{
                      ...consolationBadgeStyle,
                      color: rankBadge.color,
                      backgroundColor: rankBadge.backgroundColor,
                    }}>
                      <TrophyOutlined />
                      {rankBadge.label}
                    </span>
                  )}
                </div>

                <div style={scoreEntryBoxStyle}>
                  <Text style={scoreLabelStyle}>Phần 1</Text>
                  <Text style={scoreValueStyle}>{scores[team.id]?.part1 || 0}</Text>
                </div>

                <div style={scoreEntryBoxStyle}>
                  <Text style={scoreLabelStyle}>Phần 2</Text>
                  <Text style={scoreValueStyle}>{scores[team.id]?.part2 || 0}</Text>
                </div>
                
                <div style={part3BoxStyle}>
                  <Text style={part3LabelStyle}>Phần 3</Text>
                  <Text style={part3ValueStyle}>{scores[team.id]?.part3 || 0}</Text>
                </div>

                <div style={totalScoreBoxStyle}>
                  <Text style={totalScoreLabelStyle}>TỔNG</Text>
                  <Text style={totalScoreValueStyle}>{scores[team.id]?.total || 0}</Text>
                </div>
              </div>
            </Col>
          );
          })}
        </Row>
      </div>

      <div style={{
          position: 'absolute',
          bottom: '30px',
          right: '30px',
          zIndex: 1000,
      }}>
          <Button
              icon={<TrophyOutlined />}
              style={showAwardBadges ? activeControlButtonStyle : controlButtonBaseStyle}
              onClick={() => setShowAwardBadges((prev) => !prev)}
              title={showAwardBadges ? 'Ẩn badge giải' : 'Hiện badge giải'}
          />
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
              onClick={() => navigate(`/organizer/contest/${matchId}`)} // Navigate back to the specific contest dashboard
              title="Về lại trang điều khiển"
          />
      </div>
    </div>
  );
};

export default FullScreenScoreboard;
