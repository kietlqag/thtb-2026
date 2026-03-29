import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button, Spin, Row, Col } from 'antd';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../../services/firebase/config';
import mainContestBackground from '../../assets/images/main_background.png';
import { HomeOutlined, TrophyOutlined } from '@ant-design/icons';

function Contest() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [matchExists, setMatchExists] = useState(false);
  const [loading, setLoading] = useState(true);

  const requestFullScreen = useCallback(() => {
    const elem = document.documentElement;
    if (!document.fullscreenElement) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(err => {
          console.warn(`Yêu cầu full-screen bị từ chối hoặc lỗi: ${err.message}`);
        });
      } else if (elem.mozRequestFullScreen) {elem.mozRequestFullScreen();}
      else if (elem.webkitRequestFullscreen) {elem.webkitRequestFullscreen();}
      else if (elem.msRequestFullscreen) {elem.msRequestFullscreen();}
    }
  }, []);

  useEffect(() => {
    requestFullScreen();
  }, [requestFullScreen]);

  useEffect(() => {
    const handleResize = () => {
      console.log(`Kích thước màn hình thay đổi: Width = ${window.innerWidth}, Height = ${window.innerHeight}`);
    };

    // Log kích thước ban đầu
    handleResize();

    window.addEventListener('resize', handleResize);

    // Cleanup listener khi component unmount
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []); // useEffect này chỉ chạy một lần khi mount và cleanup khi unmount

  useEffect(() => {
    if (!matchId) {
      navigate('/organizer');
      return;
    }

    setLoading(true);
    const matchRef = ref(database, `matches/${matchId}`);
    const listener = onValue(matchRef, (snapshot) => {
      if (snapshot.exists()) {
        setMatchExists(true);
        console.log("Contest: Match data exists for ID:", matchId);
      } else {
        setMatchExists(false);
        console.error("Contest: Không tìm thấy dữ liệu trận đấu ID:", matchId);
        navigate('/organizer', { replace: true, state: { error: "Không tìm thấy trận đấu" } });
      }
      setLoading(false);
    }, (error) => {
      console.error("Contest: Firebase read failed:", error);
      setLoading(false);
      navigate('/organizer', { replace: true, state: { error: "Lỗi tải dữ liệu trận đấu" } });
    });
    return () => {
      off(matchRef, 'value', listener);
    };
  }, [matchId, navigate]);

  const getButtonActiveState = (pathSegment) => {
    if (pathSegment === 'scoreboard' && location.pathname.startsWith(`/organizer/scoreboard/${matchId}`)) return true;
    if (pathSegment === 'part1' && location.pathname.startsWith(`/organizer/contest/${matchId}/part1`)) return true;
    if (pathSegment === 'part2' && location.pathname.startsWith(`/organizer/contest/${matchId}/part2`)) return true;
    if (pathSegment === 'part3' && location.pathname.startsWith(`/organizer/contest/${matchId}/part3`)) return true;
    return false;
  };

  if (loading) {
    return (
      <Row justify="center" align="middle" style={{ 
          minHeight: '100vh', 
          backgroundColor: '#001529' 
      }}>
        <Col>
          <Spin size="large" tip="Đang kiểm tra trận đấu..." />
        </Col>
      </Row>
    );
  }

  if (!matchExists && !loading) {
    return (
      <Row justify="center" align="middle" style={{ minHeight: '100vh', padding: 20 }}>
        <Col style={{ textAlign: 'center', color: 'red' }}>
          <h2>Trận đấu không tồn tại hoặc đã xảy ra lỗi.</h2>
          <Button onClick={() => navigate('/organizer')} type="primary">Quay lại</Button>
        </Col>
      </Row>
    );
  }

  const controlButtonBaseStyle = {
    width: '50px',
    height: '50px',
    fontSize: '18px',
    fontWeight: 'bold',
    border: '2px solid white',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    color: 'white', 
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 0px 10px rgba(255, 255, 255, 0.3)',
    padding: 0, 
    borderRadius: '8px', // Added for consistency
  };

  const activeButtonStyle = {
    ...controlButtonBaseStyle,
    borderColor: '#FFD700',
    color: '#FFD700',
    backgroundColor: 'rgba(50, 50, 0, 0.5)',
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundImage: `url(${mainContestBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <div
        style={{
          position: 'absolute',
          bottom: '30px',
          right: '30px',
          display: 'flex',
          gap: '10px',
          zIndex: 1000,
        }}
      >
        <Button
            icon={<TrophyOutlined />}
            style={getButtonActiveState('scoreboard') ? activeButtonStyle : controlButtonBaseStyle}
            onClick={() => navigate(`/organizer/scoreboard/${matchId}`)}
            title="Mở bảng xếp hạng"
        />
        <Button 
            style={getButtonActiveState('part1') ? activeButtonStyle : controlButtonBaseStyle}
            onClick={() => navigate(`/organizer/contest/${matchId}/part1`)} 
        >
            1
        </Button>
        <Button 
            style={getButtonActiveState('part2') ? activeButtonStyle : controlButtonBaseStyle}
            onClick={() => navigate(`/organizer/contest/${matchId}/part2`)} 
        >
            2
        </Button>
        <Button 
            style={getButtonActiveState('part3') ? activeButtonStyle : controlButtonBaseStyle}
            onClick={() => navigate(`/organizer/contest/${matchId}/part3`)} 
        >
            3
        </Button>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: '30px',
          left: '30px',
          zIndex: 1000,
        }}
      >
        <Button
          icon={<HomeOutlined />}
          style={controlButtonBaseStyle}
          onClick={() => navigate('/organizer')}
          title="Về trang chủ Organizer"
        />
      </div>
    </div>
  );
}

export default Contest; 
