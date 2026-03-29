import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import Login from './pages/Login';
import AdminLayout from './layouts/AdminLayout';
import OrganizerLayout from './layouts/OrganizerLayout';
import TeamLayout from './layouts/TeamLayout';
import Matches from './pages/admin/Matches';
import Teams from './pages/admin/Teams';
import Questions from './pages/admin/Questions';
import Scores from './pages/admin/Scores';
import OrganizerHome from './pages/organizer/Home';
import Contest from './pages/organizer/Contest';
import ContestPart1 from './pages/organizer/ContestPart1';
import ContestPart2 from './pages/organizer/ContestPart2';
import ContestPart3 from './pages/organizer/ContestPart3';
import TeamHome from './pages/team/Home';
import TeamPartSelection from './pages/team/TeamPartSelection';
import TeamContestPart2 from './pages/team/TeamContestPart2';
import FullScreenScoreboard from './pages/organizer/FullScreenScoreboard';
import PartScoreboard from './pages/organizer/PartScoreboard';
import './styles/global.css';

// Protected Route Component
function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <Navigate to="/login" state={{ message: "Bạn không có quyền truy cập trang này." }} />;
  }

  return children;
}

function App() {
  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          colorPrimary: '#1976d2',
        },
      }}
    >
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Admin Routes */}
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route path="teams" element={<Teams />} />
              <Route path="matches" element={<Matches />} />
              <Route path="questions" element={<Questions />} />
              <Route path="scores" element={<Scores />} />
              <Route index element={<Navigate to="matches" />} />
            </Route>

            {/* Organizer Routes */}
            <Route
              path="/organizer"
              element={
                <ProtectedRoute allowedRoles={['organizer']}>
                  <OrganizerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<OrganizerHome />} />
            </Route>

            {/* Routes cho màn hình cuộc thi và các phần thi của Organizer (fullscreen, không dùng OrganizerLayout) */}
            <Route
              path="/organizer/contest/:matchId"
              element={
                <ProtectedRoute allowedRoles={['organizer']}>
                  <Contest />
                </ProtectedRoute>
              }
            />
            <Route
              path="/organizer/contest/:matchId/part1"
              element={
                <ProtectedRoute allowedRoles={['organizer']}>
                  <ContestPart1 />
                </ProtectedRoute>
              }
            />
            <Route
              path="/organizer/contest/:matchId/part2"
              element={
                <ProtectedRoute allowedRoles={['organizer']}>
                  <ContestPart2 />
                </ProtectedRoute>
              }
            />
            <Route
              path="/organizer/contest/:matchId/part3"
              element={
                <ProtectedRoute allowedRoles={['organizer']}>
                  <ContestPart3 />
                </ProtectedRoute>
              }
            />
            <Route
              path="/organizer/scoreboard/:matchId"
              element={
                <ProtectedRoute allowedRoles={['organizer']}>
                  <FullScreenScoreboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/organizer/contest/:matchId/:partKey/scoreboard"
              element={
                <ProtectedRoute allowedRoles={['organizer']}>
                  <PartScoreboard />
                </ProtectedRoute>
              }
            />

            {/* Team Routes */}
            <Route
              path="/team/*"
              element={
                <ProtectedRoute allowedRoles={['team']}>
                  <TeamLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<TeamHome />} />
            </Route>

            <Route path="/team/match/:matchId/select-part" element={<TeamPartSelection />} />
            <Route path="/team/contest/:matchId/part2" element={<TeamContestPart2 />} />

            {/* Default Route */}
            <Route path="/" element={<Navigate to="/organizer" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default App;
