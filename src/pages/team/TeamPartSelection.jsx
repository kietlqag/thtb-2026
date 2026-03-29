import { Button, Typography, Space } from 'antd';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import commonPartBackground from '../../assets/images/contest_background.png'; // Assuming you want the same background
import { ArrowLeftOutlined } from '@ant-design/icons';
import { message } from 'antd';

const { Title } = Typography;

function TeamPartSelection() {
    const navigate = useNavigate();
    const { matchId } = useParams();
    const location = useLocation();
    const teamId = location.state?.teamId;
    const teamDisplayName = location.state?.teamDisplayName;

    const handleSelectPart2 = () => {
        if (matchId && teamId) {
            navigate(`/team/contest/${matchId}/part2`, { state: { teamId, teamDisplayName, matchId } });
        } else {
            console.error("Match ID or Team ID is missing for navigating to Part 2.");
            message.error("Không thể chuyển đến phần thi, thiếu thông tin.");
            navigate('/team'); 
        }
    };
    
    const handleBack = () => {
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
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        textAlign: 'center',
        position: 'relative',
    };

    const buttonStyle = {
        minWidth: '300px',
        height: '80px',
        fontSize: '24px',
        fontWeight: 'bold',
    };

    const headerStyle = {
        position: 'absolute',
        top: '30px',
        left: '30px',
        zIndex: 10,
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
                    style={{ 
                        color: 'white', 
                        borderColor: 'white',
                        boxShadow: '0px 0px 10px rgba(0,0,0,0.5)',
                    }} 
                />
            </div>
            <Title level={1} style={{ color: 'white', marginBottom: '50px', textShadow: '2px 2px 4px rgba(0,0,0,0.7)' }}>
                {teamDisplayName ? `Đội ${teamDisplayName}, ` : ''}Chọn Phần Thi
            </Title>
            <Space direction="vertical" size="large">
                <Button
                    type="primary"
                    style={buttonStyle}
                    onClick={handleSelectPart2}
                >
                    Vào Phần Thi 2
                </Button>
                {/* Add buttons for other parts here if needed in the future */}
            </Space>
        </div>
    );
}

export default TeamPartSelection; 