import { useState } from 'react';
import { Layout, Menu, Button, theme } from 'antd';
import {
  TeamOutlined,
  TrophyOutlined,
  FileTextOutlined,
  BarChartOutlined,
  LogoutOutlined
} from '@ant-design/icons';
import { useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const { Header, Sider, Content } = Layout;

function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const menuItems = [
    {
      key: 'teams',
      icon: <TeamOutlined />,
      label: 'Quản lý đội thi',
      onClick: () => navigate('/admin/teams')
    },
    {
      key: 'matches',
      icon: <TrophyOutlined />,
      label: 'Quản lý trận đấu',
      onClick: () => navigate('/admin/matches')
    },
    {
      key: 'questions',
      icon: <FileTextOutlined />,
      label: 'Quản lý câu hỏi',
      onClick: () => navigate('/admin/questions')
    },
    {
      key: 'scores',
      icon: <BarChartOutlined />,
      label: 'Quản lý điểm',
      onClick: () => navigate('/admin/scores')
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={(value) => setCollapsed(value)}
        theme="light"
      >
        <div style={{ 
          height: 32, 
          margin: 16, 
          background: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#1976d2',
          fontWeight: 'bold'
        }}>
          {!collapsed && 'Admin Panel'}
        </div>
        <Menu
          theme="light"
          defaultSelectedKeys={['matches']}
          mode="inline"
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{ 
          padding: 0, 
          background: colorBgContainer,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingRight: '24px'
        }}>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={handleLogout}
          >
            Đăng xuất
          </Button>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: colorBgContainer, borderRadius: borderRadiusLG }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default AdminLayout; 