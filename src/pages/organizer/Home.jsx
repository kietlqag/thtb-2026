import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Select, Button, Typography, Spin, Row, Col, Card, Alert } from 'antd';
import { ref, onValue, update } from 'firebase/database';
import { database } from '../../services/firebase/config'; // Quay lại đường dẫn này

const { Title, Text } = Typography;
const { Option } = Select;

function OrganizerHome() {
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError(null);
    const matchesRef = ref(database, 'matches');
    console.log("OrganizerHome: Subscribing to Firebase matches path...");

    const unsubscribe = onValue(matchesRef, (snapshot) => {
      const data = snapshot.val();
      console.log("OrganizerHome: Firebase snapshot data received:", data);
      if (data) {
        const allMatchesArray = Object.entries(data).map(([id, matchData]) => ({
          id,
          ...matchData,
        }));
        console.log("OrganizerHome: All matches array:", allMatchesArray);

        const activeMatches = allMatchesArray.filter(
          match => {
            // Đảm bảo match.status là string trước khi so sánh
            const statusString = String(match.status).toLowerCase();
            const isActive = statusString === 'chua_thi' || statusString === 'dang_thi';
            // console.log(`Match ID: ${match.id}, Title: ${match.title}, Status: ${match.status}, IsActive: ${isActive}`);
            return isActive;
          }
        );
        console.log("OrganizerHome: Filtered active matches:", activeMatches);
        setMatches(activeMatches);
        if (activeMatches.length === 0 && allMatchesArray.length > 0) {
          setError("Không có trận đấu nào đang ở trạng thái 'chưa thi' hoặc 'đang thi'.");
        } else if (allMatchesArray.length === 0) {
          setError("Không tìm thấy dữ liệu trận đấu nào trong hệ thống.");
        }
      } else {
        console.log("OrganizerHome: No data found at 'matches' path.");
        setMatches([]);
        setError("Không có dữ liệu trận đấu.");
      }
      setLoading(false);
    }, (firebaseError) => {
      console.error("OrganizerHome: Firebase read failed:", firebaseError);
      setError(`Lỗi tải dữ liệu từ Firebase: ${firebaseError.message}`);
      setLoading(false);
      setMatches([]);
    });

    // Cleanup listener on component unmount
    return () => {
      console.log("OrganizerHome: Unsubscribing from Firebase matches path.");
      unsubscribe(); // Sử dụng hàm hủy được trả về bởi onValue
    };
  }, []);

  const handleStartMatch = async () => {
    if (selectedMatchId) {
      try {
        // Update match status to 'dang_thi' in Firebase
        const matchRef = ref(database, `matches/${selectedMatchId}`);
        await update(matchRef, {
          status: 'dang_thi'
        });
        
        // Navigate to contest page after successful update
        navigate(`/organizer/contest/${selectedMatchId}`);
      } catch (error) {
        console.error("Error updating match status:", error);
        setError(`Lỗi khi cập nhật trạng thái trận đấu: ${error.message}`);
      }
    }
  };

  if (loading) {
    return (
      <Row justify="center" align="middle" style={{ minHeight: 'calc(100vh - 120px)', padding: '20px' }}>
        <Col>
          <Spin size="large" tip="Đang tải danh sách trận đấu..." />
        </Col>
      </Row>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: 'auto' }}>
      <Card>
        <Title level={2} style={{ textAlign: 'center', marginBottom: '30px' }}>
          Chào Mừng Ban Tổ Chức
        </Title>
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: '10px' }}>
          Vui lòng chọn trận đấu để bắt đầu quản lý:
        </Text>

        {error && <Alert message="Thông báo" description={error} type="warning" showIcon style={{ marginBottom: 20 }} />}

        <Select
          style={{ width: '100%', marginBottom: '20px' }}
          placeholder="Chọn trận đấu"
          onChange={(value) => setSelectedMatchId(value)}
          value={selectedMatchId}
          size="large"
          showSearch
          optionFilterProp="children"
          filterOption={(input, option) => 
            (option?.children ?? '').toString().toLowerCase().includes(input.toLowerCase())
          }
          notFoundContent={loading ? <Spin size="small" /> : "Không có trận đấu nào."}
        >
          {matches.map((match) => (
            <Option key={match.id} value={match.id}>
              {match.title}
            </Option>
          ))}
        </Select>
        
        <Button
          type="primary"
          size="large"
          onClick={handleStartMatch}
          disabled={!selectedMatchId || selectedMatchId === "no-matches"}
          block
        >
          Bắt Đầu Điều Khiển Trận Đấu
        </Button>
      </Card>
    </div>
  );
}

export default OrganizerHome; 