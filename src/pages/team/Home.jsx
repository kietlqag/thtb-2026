import { useState, useEffect } from 'react';
import { Card, Button, Select, message, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { database } from '../../services/firebase/config';
import { ref, get, set } from 'firebase/database';

const { Title } = Typography;

function Home() {
  const [matches, setMatches] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [displayableTeams, setDisplayableTeams] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [selectedTeamObj, setSelectedTeamObj] = useState(null);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [loadingAllTeams, setLoadingAllTeams] = useState(false);
  const [joining, setJoining] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMatches();
    fetchAllTeamsData();
  }, []);

  useEffect(() => {
    if (selectedMatchId && matches.length > 0 && allTeams.length > 0) {
      const currentMatch = matches.find(m => m.id === selectedMatchId);
      if (currentMatch && currentMatch.team_ids) {
        const participatingTeamIds = currentMatch.team_ids;
        const filteredTeams = allTeams.filter(team => participatingTeamIds.includes(team.id));
        setDisplayableTeams(filteredTeams);

        if (selectedTeamObj && !filteredTeams.find(ft => ft.id === selectedTeamObj.id)) {
          setSelectedTeamObj(null);
        }
        if (filteredTeams.length === 0) {
          message.info('Không có đội nào được gán cho trận đấu này. Vui lòng liên hệ BTC.');
        }

      } else {
        setDisplayableTeams([]);
         if (currentMatch && !currentMatch.team_ids) {
          message.warn('Trận đấu này chưa có đội nào được gán. Vui lòng liên hệ BTC.');
        }
      }
    } else {
      setDisplayableTeams([]);
    }
  }, [selectedMatchId, matches, allTeams, selectedTeamObj]);

  const fetchMatches = async () => {
    setLoadingMatches(true);
    try {
      const matchesRef = ref(database, 'matches');
      const snapshot = await get(matchesRef);
      if (snapshot.exists()) {
        const matchesData = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          ...data
        }));
        setMatches(matchesData);
      } else {
        setMatches([]);
        message.info('Không có trận đấu nào được cấu hình.');
      }
    } catch (error) {
      message.error('Lỗi khi tải danh sách trận đấu');
      console.error("Error fetching matches:", error);
    } finally {
      setLoadingMatches(false);
    }
  };

  const fetchAllTeamsData = async () => {
    setLoadingAllTeams(true);
    try {
      const teamsRef = ref(database, 'teams');
      const snapshot = await get(teamsRef);
      if (snapshot.exists()) {
        const teamsData = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          name: data.name,
        }));
        setAllTeams(teamsData);
      } else {
        setAllTeams([]);
        message.info('Không có đội nào được cấu hình trong hệ thống.');
      }
    } catch (error) {
      message.error('Lỗi khi tải danh sách đội');
      console.error("Error fetching all teams:", error);
    } finally {
      setLoadingAllTeams(false);
    }
  };

  const handleJoin = async () => {
    if (!selectedMatchId || !selectedTeamObj) {
      message.warning('Vui lòng chọn trận đấu và đội của bạn');
      return;
    }

    setJoining(true);
    try {
      const matchDataRef = ref(database, `matches/${selectedMatchId}`);
      const matchSnapshot = await get(matchDataRef);

      if (!matchSnapshot.exists()) {
        message.error('Trận đấu không tồn tại.');
        setJoining(false);
        return;
      }
      
      const teamParticipationRef = ref(database, `matches/${selectedMatchId}/participation/teams/${selectedTeamObj.id}`);
      
      await set(teamParticipationRef, {
        name: selectedTeamObj.name,
        joinedAt: Date.now(),
      });
      
      const matchTitle = matches.find(m => m.id === selectedMatchId)?.title || selectedMatchId;
      message.success(`Đội "${selectedTeamObj.name}" đã tham gia trận đấu "${matchTitle}"`);
      navigate(`/team/match/${selectedMatchId}/select-part`, { 
        state: { 
          teamId: selectedTeamObj.id, 
          teamDisplayName: selectedTeamObj.name,
          matchId: selectedMatchId 
        } 
      });

    } catch (error) {
      console.error("Error joining match:", error);
      message.error('Lỗi khi tham gia trận đấu: ' + error.message);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh', 
        padding: '20px',
        background: '#f0f2f5'
    }}>
      <Card
        style={{ 
            width: '100%', 
            maxWidth: 700,
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
        }}
      >
        <Title level={3} style={{ textAlign: 'center', marginBottom: '30px' }}>
          Tham Gia Trận Đấu
        </Title>
        <Select
          style={{ width: '100%', marginBottom: 25, fontSize: '16px' }}
          size="large"
          placeholder="Chọn trận đấu"
          loading={loadingMatches}
          onChange={(value) => {
            setSelectedMatchId(value);
            setSelectedTeamObj(null);
          }}
          value={selectedMatchId}
          options={matches.map(match => ({
            label: match.title,
            value: match.id
          }))}
          disabled={matches.length === 0 && !loadingMatches}
        />

        <Select
          style={{ width: '100%', marginBottom: 30, fontSize: '16px' }}
          size="large"
          placeholder="Chọn đội của bạn"
          loading={loadingAllTeams || (selectedMatchId && loadingMatches)}
          onChange={(value, option) => setSelectedTeamObj({ id: value, name: option.label })}
          value={selectedTeamObj?.id}
          options={displayableTeams.map(team => ({
            label: team.name,
            value: team.id,
          }))}
          disabled={!selectedMatchId || displayableTeams.length === 0 || loadingAllTeams}
        />

        <Button
          type="primary"
          size="large"
          block
          style={{ fontSize: '18px', height: '50px' }}
          onClick={handleJoin}
          disabled={!selectedMatchId || !selectedTeamObj || joining}
          loading={joining}
        >
          Xác Nhận Tham Gia
        </Button>
      </Card>
    </div>
  );
}

export default Home; 