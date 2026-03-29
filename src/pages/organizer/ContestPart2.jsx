import { useEffect, useState } from 'react';
import { Button, Modal, Spin, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftOutlined, BookOutlined, TrophyOutlined } from '@ant-design/icons';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../../services/firebase/config';
import commonPartBackground from '../../assets/images/contest_background.png';

const { Paragraph, Title, Text } = Typography;
const RULES_FILE = '/rules/rules_contest_2.html';

const RulesModalPart2 = ({ visible, onClose, rulesContent }) => (
  <Modal
    title="Thể lệ Phần thi 2: Khát vọng"
    open={visible}
    onCancel={onClose}
    width="82vw"
    centered
    destroyOnHidden
    styles={{ body: { padding: '12px 16px' } }}
    getContainer={false}
    footer={[
      <Button key="close" onClick={onClose} style={{ fontSize: '16px', padding: '5px 20px', height: 'auto' }}>
        Đóng
      </Button>,
    ]}
  >
    {rulesContent ? (
      <div dangerouslySetInnerHTML={{ __html: rulesContent }} />
    ) : (
      <Paragraph>Đang tải thể lệ...</Paragraph>
    )}
  </Modal>
);

function ContestPart2() {
  const { matchId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rulesVisible, setRulesVisible] = useState(false);
  const [rulesHtmlContent, setRulesHtmlContent] = useState('');
  const [loadingRules, setLoadingRules] = useState(false);

  useEffect(() => {
    if (!matchId) {
      setError('ID trận đấu không hợp lệ.');
      setLoading(false);
      return;
    }

    const matchRef = ref(database, `matches/${matchId}`);
    const listener = onValue(
      matchRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setError('Không tìm thấy trận đấu.');
          setLoading(false);
          return;
        }

        setError(null);
        setLoading(false);
      },
      () => {
        setError('Không thể tải dữ liệu phần thi.');
        setLoading(false);
      }
    );

    return () => off(matchRef, 'value', listener);
  }, [matchId]);

  const fetchRulesContent = async () => {
    setLoadingRules(true);
    try {
      const response = await fetch(`${RULES_FILE}?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const htmlText = await response.text();
      setRulesHtmlContent(htmlText);
    } catch (fetchError) {
      console.error('Error fetching rules HTML for Part 2:', fetchError);
      setRulesHtmlContent('<p>Không thể tải được nội dung thể lệ. Vui lòng thử lại sau.</p>');
    }
    setLoadingRules(false);
  };

  const handleShowRules = () => {
    if (!rulesHtmlContent && !loadingRules) {
      fetchRulesContent();
    }
    setRulesVisible(true);
  };

  const handleCloseRules = () => setRulesVisible(false);

  const controlButtonStyle = {
    width: '52px',
    height: '52px',
    fontSize: '18px',
    fontWeight: 'bold',
    border: '2px solid white',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    color: 'white',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 0 10px rgba(255, 255, 255, 0.3)',
    borderRadius: '10px',
    padding: 0,
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

  if (loading) {
    return (
      <div style={{ ...screenStyle, alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="Đang tải phần thi 2..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...screenStyle, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Title level={3} style={{ color: 'white', marginBottom: 8 }}>Lỗi</Title>
        <Text style={{ color: 'white', fontSize: 18 }}>{error}</Text>
      </div>
    );
  }

  return (
    <div style={screenStyle}>
      <div
        style={{
          width: '100%',
          flexGrow: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <Title
          level={1}
          style={{
            color: '#FFF7D6',
            textAlign: 'center',
            textShadow: '0 0 18px rgba(10, 40, 120, 0.45), 3px 3px 12px rgba(0, 0, 0, 0.35)',
            fontWeight: 'bold',
            fontSize: 'clamp(3rem, 6vw, 6rem)',
            margin: 0,
            padding: '0 20px',
            lineHeight: '1.3',
          }}
        >
          PHẦN THI <br /> "KHÁT VỌNG"
        </Title>
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
          icon={<ArrowLeftOutlined />}
          style={controlButtonStyle}
          onClick={() => navigate(`/organizer/contest/${matchId}`)}
          title="Về màn hình chính"
        />
      </div>

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
          style={controlButtonStyle}
          onClick={() => navigate(`/organizer/contest/${matchId}/part2/scoreboard`)}
          title="Xem điểm phần thi 2"
        />
        <Button
          icon={<BookOutlined />}
          style={controlButtonStyle}
          onClick={handleShowRules}
          title="Xem thể lệ phần thi 2"
        />
      </div>

      <RulesModalPart2
        visible={rulesVisible}
        onClose={handleCloseRules}
        rulesContent={loadingRules ? '<p>Đang tải thể lệ...</p>' : rulesHtmlContent}
      />
    </div>
  );
}

export default ContestPart2;
