import { Button, Card, Typography } from 'antd';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftOutlined } from '@ant-design/icons';
import commonPartBackground from '../../assets/images/contest_background.png';

const { Title, Paragraph, Text } = Typography;

function TeamContestPart2() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const teamId = location.state?.teamId;
  const teamDisplayName = location.state?.teamDisplayName;

  const handleBack = () => {
    if (matchId) {
      navigate(`/team/match/${matchId}/select-part`, {
        state: { teamId, teamDisplayName, matchId },
      });
      return;
    }

    navigate('/team');
  };

  const screenStyle = {
    width: '100vw',
    height: '100vh',
    backgroundImage: `url(${commonPartBackground})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  };

  const headerStyle = {
    width: '100%',
    backgroundColor: '#d13c30',
    padding: '14px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
  };

  const backButtonStyle = {
    position: 'absolute',
    top: '50%',
    left: '30px',
    transform: 'translateY(-50%)',
    zIndex: 2,
    color: 'white',
    borderColor: 'white',
  };

  return (
    <div style={screenStyle}>
      <div style={headerStyle}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={handleBack}
          type="primary"
          shape="circle"
          size="large"
          ghost
          style={backButtonStyle}
        />
        <Title
          level={3}
          style={{
            color: 'white',
            margin: 0,
            fontSize: 'clamp(22px, 4vw, 34px)',
            fontWeight: 'bold',
          }}
        >
          PHẦN THI 2: KHÁT VỌNG
        </Title>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '28px',
        }}
      >
        <Card
          style={{
            width: 'min(780px, 92vw)',
            borderRadius: 26,
            background: 'rgba(255,255,255,0.9)',
            boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
          }}
          styles={{ body: { padding: '30px 34px', textAlign: 'center' } }}
        >
          <Title level={2} style={{ color: '#d13c30', marginTop: 0 }}>
            {teamDisplayName ? `Đội ${teamDisplayName}` : 'Phần thuyết trình'}
          </Title>
          <Paragraph style={{ fontSize: 18, marginBottom: 12 }}>
            Phần 2 được tổ chức theo hình thức thuyết trình, không trả lời câu hỏi trực tiếp trên màn hình này.
          </Paragraph>
          <Paragraph style={{ fontSize: 17, marginBottom: 0 }}>
            Điểm của đội sẽ do Ban tổ chức nhập sau phần trình bày và hiển thị trên bảng điểm.
          </Paragraph>
          <Text type="secondary" style={{ display: 'block', marginTop: 18, fontSize: 15 }}>
            Vui lòng chờ hướng dẫn từ Ban tổ chức.
          </Text>
        </Card>
      </div>
    </div>
  );
}

export default TeamContestPart2;
