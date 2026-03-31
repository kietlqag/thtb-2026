import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Spin, Row, Col, Typography, Modal, List, Card, Radio, Space, message } from 'antd';
import { 
    CheckCircleOutlined, 
    CloseCircleOutlined, 
    LeftOutlined, 
    RightOutlined,
    ArrowLeftOutlined, // For back to main contest screen
    BookOutlined,      // For Rules button (T)
    BarChartOutlined,  // For Score button (Đ)
    PlayCircleOutlined, // For Start button (B)
    PauseCircleOutlined,
    TrophyOutlined
} from '@ant-design/icons';
import { ref, onValue, off, update, get, set, serverTimestamp } from 'firebase/database';
import { database } from '../../services/firebase/config';
import commonPartBackground from '../../assets/images/contest_background.png'; // Background chung
import logo1 from '../../assets/images/logo1.png';
import logo2 from '../../assets/images/logo2.png';

const { Title, Text, Paragraph } = Typography;

// Constants
const PART_TITLE = "PHẦN THI TIÊN PHONG";

// --- Các sub-components cho các màn hình bên trong ContestPart1 ---

// Helper function to convert number to Roman numeral (simplified for I-IV for now)
const toRoman = (num) => {
  if (num === 1) return 'I';
  if (num === 2) return 'II';
  if (num === 3) return 'III';
  if (num === 4) return 'IV';
  return num.toString(); // Fallback for numbers > 4 or non-standard
};

const getYoutubeEmbedUrl = (url) => {
  if (!url) return null;
  let videoId = null;

  // Regex to capture video ID from various YouTube URL formats
  // Handles:
  // - youtube.com/watch?v=VIDEO_ID
  // - youtu.be/VIDEO_ID
  // - youtube.com/embed/VIDEO_ID
  // - youtube.com/v/VIDEO_ID
  // - youtube-nocookie.com/...
  const regex = /(?:youtube(?:-nocookie)?\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);

  if (match && match[1]) {
    videoId = match[1];
  } else {
    console.warn('Could not parse YouTube URL to find Video ID:', url);
    return null; 
  }

  if (videoId) {
    let startTimeQuery = '';
    // Try to parse 't' parameter (e.g., t=1m30s, t=90s, t=90)
    if (url.includes('t=')) {
        try {
            const tMatch = url.match(/[?&]t=([^&]+)/);
            if (tMatch && tMatch[1]) {
                const tValue = tMatch[1];
                let seconds = 0;
                const minutesMatch = tValue.match(/(\d+)m/);
                const secondsMatch = tValue.match(/(\d+)s/);
                // Handles case where tValue is just a number (e.g., "90")
                const plainSecondsMatch = tValue.match(/^(\d+)$/);

                if (minutesMatch) seconds += parseInt(minutesMatch[1]) * 60;
                // Add seconds from "Ns" part, ensuring it's not double-counted if plainSecondsMatch also matches
                if (secondsMatch) {
                   seconds += parseInt(secondsMatch[1]);
                } else if (!minutesMatch && plainSecondsMatch) { 
                  // Only if no 'm' and no 's' suffix, treat plain number as seconds
                  seconds = parseInt(plainSecondsMatch[1]);
                }
                
                if (seconds > 0) {
                    startTimeQuery = `?start=${seconds}`;
                }
            }
        } catch(e) {
            console.warn("Error parsing 't' parameter from YouTube URL:", url, e);
        }
    }
    return `https://www.youtube.com/embed/${videoId}${startTimeQuery}`;
  }
  
  // Should not be reached if regex found an ID and it was processed
  console.warn('Failed to construct YouTube embed URL for:', url);
  return null;
};

// Màn hình CHỌN GÓI - TÁI CẤU TRÚC HOÀN TOÀN
const LegacyPackageSelectionScreen = ({
  partTitle, 
  packages,
  teams, 
  onSelectPackage,
  onBackToIntroScreen, 
  selectedTeamIdForPackage, 
  onSelectTeamForPackage,
  matchScores, // New prop for scores
}) => {
  // Redefine control button styles here for use in this component
  // Ensuring they match the latest specification (50px size)
  const localControlButtonBaseStyle = {
    width: '50px',
    height: '50px',
    fontSize: '18px', // For icon if any, or direct text
    fontWeight: 'bold',
    border: '2px solid white',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    color: 'white',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 0px 10px rgba(255, 255, 255, 0.3)',
    borderRadius: '8px',
  };

  const localActiveButtonStyle = {
    ...localControlButtonBaseStyle,
    backgroundColor: '#FFC107',
    borderColor: '#FFC107',
  };

  const packageLayout = [
    { dataKey: 'package_1', label: 'I', color: '#d13c30' }, // category-1
    { dataKey: 'package_2', label: 'II', color: '#4aafce' }, // category-2
    { dataKey: 'package_3', label: 'III', color: '#f7913e' },
    { dataKey: 'package_4', label: 'IV', color: '#5ebfb5' },
    { dataKey: 'package_5', label: 'V', color: '#8e44ad' },
    { dataKey: 'package_6', label: 'VI', color: '#16a085' },
    { dataKey: 'package_7', label: 'VII', color: '#e67e22' }
  ];

  const availablePackages = packages && Object.keys(packages).length > 0;

  // Styles based on the provided CSS
  const headerStyle = {
    width: '100%',
    backgroundColor: '#d13c30', // From CSS header
    minHeight: '80px', // CSS: 10vh, min 60px, max 80px
    padding: '10px 30px', // Adjusted padding
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center', // Center title now that back button is removed from here
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
    position: 'relative', 
    zIndex: 20, 
  };

  const headerTitleStyle = {
    margin: 0,
    color: 'white',
    textTransform: 'uppercase', // Kept from original, CSS uses normal
    letterSpacing: '1px',       // Kept from original
    fontSize: 'clamp(20px, 3.5vw, 36px)', // Adjusted from CSS h1
    fontWeight: 'bold',
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)', // From CSS h1
  };
  
  const mainContentStyle = { // Equivalent to CSS main > .category-grid
    flexGrow: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    padding: '20px', // CSS .category-grid padding: 0 20px;
    position: 'relative', // For z-indexing if background elements were used
    overflow: 'hidden', // To contain potential overflow from animations if added later
  };

  const gridContainerStyle = { // Equivalent to CSS .grid-container
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 'clamp(15px, 3vh, 30px)', // from CSS, adjusted min slightly
    width: 'min(96%, 1700px)',
    gridAutoRows: 'minmax(180px, 1fr)',
    maxHeight: 'calc(100vh - 240px)',
    zIndex: 10, // from CSS .category-grid (applied here for content)
  };

  const categoryBaseStyle = { // Equivalent to CSS .category
    width: '100%', // Fill grid cell
    height: '100%', // Fill grid cell
    borderRadius: '16px', // From CSS
    boxShadow: '0 8px 16px rgba(0,0,0,0.2)', // From CSS
    transition: 'all 0.3s ease', // From CSS
    overflow: 'hidden', // From CSS
    cursor: 'pointer',
    border: 'none', // Reset AntD Button border
    padding: 0, // Reset AntD Button padding
    display: 'flex', // To use for category-content
    justifyContent: 'center', // To use for category-content
    alignItems: 'center', // To use for category-content
    position: 'relative', 
  };
  
  const categoryTextStyle = { // Equivalent to CSS .category span
    margin: 0,
    color: 'white',
    fontSize: 'clamp(1.8rem, 3.2vw, 3.2rem)',
    fontWeight: 'bold',
    textShadow: '2px 2px 4px rgba(0,0,0,0.3)', // From CSS
    zIndex: 1,
    textAlign: 'center',
    padding: '0 12px',
  };

  const teamNavContainerStyle = {
    position: 'absolute',
    bottom: '30px',
    right: '30px',
    zIndex: 20,
    display: 'flex',
    alignItems: 'center', // Align items vertically
    gap: '10px',
  };

  // Style for the selected team name display
  const selectedTeamNameStyle = {
    height: '50px', // Match button height
    padding: '0 15px',
    backgroundColor: 'rgba(0, 0, 0, 0.35)', // Semi-transparent background
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 'bold',
    boxShadow: '0px 0px 8px rgba(0, 0, 0, 0.2)',
    marginRight: '5px', // Add a small gap if team name is to the left of buttons
  };

  const selectedTeam = teams.find(team => team.id === selectedTeamIdForPackage);
  const selectedTeamNameToDisplay = selectedTeam ? selectedTeam.name : "Chưa chọn đội";


  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'flex-start', 
        padding: 0, 
        position: 'relative', 
      }}
    >
      {/* Header - Back button removed from here */}
      <div style={headerStyle}>
        {/* Back button removed from here, will be added at the bottom */}
        <Title level={2} style={headerTitleStyle}>
          {partTitle}
        </Title>
      </div>

      {/* Nội dung chính - Các ô chọn gói */}
      <div style={mainContentStyle}>
        {!availablePackages ? (
          <Text style={{color: '#ffc107', fontSize: '24px', fontStyle: 'italic', backgroundColor: 'rgba(0,0,0,0.7)', padding: '20px', borderRadius: '10px'}}>
            Phần thi này chưa có gói câu hỏi nào.
          </Text>
        ) : (
          <div style={gridContainerStyle}>
            {packageLayout.map((pkgInfo) => {
              const packageData = packages[pkgInfo.dataKey];
              const isPackageUsed = matchScores && matchScores[pkgInfo.dataKey];

              if (!packageData) {
                return (
                  <div key={pkgInfo.dataKey} style={{
                    ...categoryBaseStyle,
                    backgroundColor: '#555',
                    border: '2px dashed #777',
                    cursor: 'default',
                  }}>
                    <Text style={{...categoryTextStyle, fontSize: '2rem', color: '#aaa'}}>?</Text>
                  </div>
                );
              }
              
              return (
                <Button
                  key={pkgInfo.dataKey}
                  onClick={() => {
                    if (!selectedTeamIdForPackage && teams && teams.length > 0) {
                      Modal.warning({ title: "Vui lòng chọn đội", content: "Bạn cần chọn một đội thi trước khi chọn gói câu hỏi."});
                      return;
                    }
                    // Add logic here if clicking a "used" package should do something different
                    // For now, it just proceeds as normal.
                    onSelectPackage(pkgInfo.dataKey, selectedTeamIdForPackage); 
                  }}
                  style={{
                    ...categoryBaseStyle,
                    backgroundColor: pkgInfo.color,
                    ...(isPackageUsed && {
                      opacity: 0.6, // "Disabled" appearance
                      // cursor: 'not-allowed', // Optional: if you want to change cursor
                                                // but requirement is "vẫn có thể nhấn vào được"
                    })
                  }}
                  onMouseOver={(e) => {
                    if (!isPackageUsed) { // Optional: only apply hover effect if not "used"
                      e.currentTarget.style.transform = 'translateY(-5px)';
                      e.currentTarget.style.boxShadow = '0 12px 20px rgba(0,0,0,0.3)';
                    }
                  }}
                  onMouseOut={(e) => {
                     if (!isPackageUsed) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';
                    }
                  }}
                >
                  <Title level={1} style={categoryTextStyle}>
                    {packageData.name || pkgInfo.label} 
                  </Title>
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer - Các nút chọn đội và tên đội */}
      {teams && teams.length > 0 && (
        <div style={teamNavContainerStyle} >
          {/* Display Selected Team Name */}
          {selectedTeamIdForPackage && selectedTeam && (
            <div style={selectedTeamNameStyle}>
              {selectedTeam.name}
            </div>
          )}
          {!selectedTeamIdForPackage && (
             <div style={{...selectedTeamNameStyle, color: '#ccc', fontStyle: 'italic' }}>
              Vui lòng chọn đội
            </div>
          )}

          {/* Team Selection Buttons */}
          {teams.slice(0, 4).map((team, index) => {
            const isActive = selectedTeamIdForPackage === team.id;
            return (
              <Button
                key={team.id}
                onClick={() => onSelectTeamForPackage(team.id)}
                style={{
                  ...(isActive ? localActiveButtonStyle : localControlButtonBaseStyle),
                }}
              >
                {index + 1} 
              </Button>
            );
          })}
        </div>
      )}

      {/* New Back Button at the bottom left */}
      <div style={{
          position: 'absolute',
          bottom: '30px',
          left: '30px',
          zIndex: 1000, // Ensure it's above other content
      }}>
          <Button
              icon={<ArrowLeftOutlined />}
              style={localControlButtonBaseStyle}
              onClick={onBackToIntroScreen}
              title="Về Màn Hình Chính Phần Thi"
          />
      </div>
    </div>
  );
};

// Màn hình hiển thị câu hỏi chi tiết (REBUILT)
const PackageSelectionScreen = ({
  partTitle,
  packages,
  teams,
  onSelectPackage,
  onBackToIntroScreen,
  selectedTeamIdForPackage,
  onSelectTeamForPackage,
  usedPackages,
}) => {
  const localControlButtonBaseStyle = {
    minWidth: '56px',
    height: '56px',
    fontSize: '18px',
    fontWeight: 'bold',
    border: '2px solid white',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    color: 'white',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 0px 10px rgba(255, 255, 255, 0.3)',
    borderRadius: '8px',
  };

  const localActiveButtonStyle = {
    ...localControlButtonBaseStyle,
    backgroundColor: '#FFC107',
    borderColor: '#FFC107',
    color: '#6b2500',
  };

  const packageLayout = [
    { dataKey: 'package_1', label: 'I', color: '#d13c30' },
    { dataKey: 'package_2', label: 'II', color: '#4aafce' },
    { dataKey: 'package_3', label: 'III', color: '#f7913e' },
    { dataKey: 'package_4', label: 'IV', color: '#5ebfb5' },
    { dataKey: 'package_5', label: 'V', color: '#8e44ad' },
    { dataKey: 'package_6', label: 'VI', color: '#16a085' },
    { dataKey: 'package_7', label: 'VII', color: '#e67e22' }
  ];

  const availablePackages = packages && Object.keys(packages).length > 0;
  const selectedTeam = teams.find((team) => team.id === selectedTeamIdForPackage);
  const usedTeamIds = new Set(
    Object.values(usedPackages || {})
      .map((item) => item?.team_id)
      .filter(Boolean)
  );

  const headerStyle = {
    width: '100%',
    backgroundColor: '#d13c30',
    minHeight: '80px',
    padding: '10px 30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
    position: 'relative',
    zIndex: 20,
  };

  const headerTitleStyle = {
    margin: 0,
    color: 'white',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontSize: 'clamp(20px, 3.5vw, 36px)',
    fontWeight: 'bold',
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)',
  };

  const mainContentStyle = {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: '100%',
    padding: '16px 24px 88px',
    position: 'relative',
    overflowY: 'auto',
    gap: '22px',
  };

  const cardPanelStyle = {
    width: 'min(1500px, 96%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '16px 18px',
    background: 'rgba(255, 255, 255, 0.2)',
    border: '2px solid rgba(255,255,255,0.55)',
    borderRadius: '24px',
    boxShadow: '0 18px 45px rgba(0,0,0,0.18)',
    backdropFilter: 'blur(8px)',
  };

  const sectionTitleStyle = {
    margin: 0,
    color: 'white',
    fontSize: 'clamp(17px, 2vw, 22px)',
    fontWeight: 'bold',
    textShadow: '0 2px 8px rgba(0,0,0,0.25)',
  };

  const teamGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: '12px',
    width: '100%',
  };

  const gridContainerStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
    gap: '18px',
    width: '100%',
    gridAutoRows: 'minmax(170px, 1fr)',
  };

  const categoryBaseStyle = {
    width: '100%',
    minHeight: '170px',
    borderRadius: '26px',
    boxShadow: '0 16px 28px rgba(0,0,0,0.2)',
    transition: 'transform 0.25s ease, box-shadow 0.25s ease, filter 0.25s ease',
    overflow: 'hidden',
    cursor: 'pointer',
    border: 'none',
    padding: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    flexDirection: 'column',
    background: 'transparent',
  };

  const categoryTextStyle = {
    margin: 0,
    color: 'white',
    fontSize: 'clamp(2.5rem, 3.8vw, 4.2rem)',
    fontWeight: 'bold',
    textShadow: '0 4px 10px rgba(0,0,0,0.25)',
    lineHeight: 1,
    textAlign: 'center',
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: 0,
        position: 'relative',
      }}
    >
      <div style={headerStyle}>
        <Title level={2} style={headerTitleStyle}>
          {partTitle}
        </Title>
      </div>

      <div style={mainContentStyle}>
        <div style={cardPanelStyle}>
          <Title level={3} style={sectionTitleStyle}>
            1. Chọn đội thi trước khi mở gói
          </Title>
          <div style={teamGridStyle}>
            {teams.map((team) => {
              const isActive = selectedTeamIdForPackage === team.id;
              const isTeamUsed = usedTeamIds.has(team.id);
              return (
                <Button
                  key={team.id}
                  onClick={() => onSelectTeamForPackage(team.id)}
                  disabled={isTeamUsed}
                  style={{
                    ...(isActive ? localActiveButtonStyle : localControlButtonBaseStyle),
                    width: '100%',
                    padding: '0 16px',
                    gap: '0',
                    fontSize: '15px',
                    whiteSpace: 'normal',
                    lineHeight: 1.3,
                    height: '72px',
                    textAlign: 'center',
                    justifyContent: 'center',
                    ...(isTeamUsed ? {
                      backgroundColor: 'rgba(255,255,255,0.18)',
                      borderColor: 'rgba(255,255,255,0.45)',
                      color: 'rgba(255,255,255,0.6)',
                      cursor: 'not-allowed',
                    } : {}),
                  }}
                >
                  <span>{team.name}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {!availablePackages ? (
          <Text style={{ color: '#ffc107', fontSize: '24px', fontStyle: 'italic', backgroundColor: 'rgba(0,0,0,0.7)', padding: '20px', borderRadius: '10px' }}>
            Phần thi này chưa có gói câu hỏi nào.
          </Text>
        ) : (
          <div style={cardPanelStyle}>
            <Title level={3} style={sectionTitleStyle}>
              2. Chọn gói câu hỏi
            </Title>
            <div style={gridContainerStyle}>
              {packageLayout.map((pkgInfo) => {
                const packageData = packages[pkgInfo.dataKey];
                const packageUsageInfo = usedPackages?.[pkgInfo.dataKey];
                const isPackageUsed = !!packageUsageInfo;
                const packageIndex = packageLayout.findIndex((item) => item.dataKey === pkgInfo.dataKey);
                const isTopRow = packageIndex < 3;
                const rowStart = isTopRow ? 1 : 2;
                const colStart = isTopRow ? 2 + (packageIndex * 2) : 1 + ((packageIndex - 3) * 2);
                const colSpan = 2;

                if (!packageData) {
                  return (
                    <div key={pkgInfo.dataKey} style={{
                      ...categoryBaseStyle,
                      gridColumn: `${colStart} / span ${colSpan}`,
                      gridRow: rowStart,
                      backgroundColor: '#555',
                      border: '2px dashed #777',
                      cursor: 'default',
                    }}>
                      <Text style={{ ...categoryTextStyle, fontSize: '2rem', color: '#aaa' }}>?</Text>
                    </div>
                  );
                }

                return (
                  <Button
                    key={pkgInfo.dataKey}
                    onClick={() => {
                      if (!selectedTeamIdForPackage && teams && teams.length > 0) {
                        Modal.warning({ title: "Vui lòng chọn đội", content: "Bạn cần chọn một đội thi trước khi chọn gói câu hỏi." });
                        return;
                      }
                      onSelectPackage(pkgInfo.dataKey, selectedTeamIdForPackage);
                    }}
                    disabled={isPackageUsed}
                    style={{
                      ...categoryBaseStyle,
                      gridColumn: `${colStart} / span ${colSpan}`,
                      gridRow: rowStart,
                      ...(isPackageUsed && {
                        cursor: 'not-allowed',
                        filter: 'grayscale(0.08)',
                      })
                    }}
                    onMouseOver={(e) => {
                      if (!isPackageUsed) {
                        e.currentTarget.style.transform = 'translateY(-6px) scale(1.01)';
                        e.currentTarget.style.boxShadow = '0 22px 34px rgba(0,0,0,0.24)';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!isPackageUsed) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 16px 28px rgba(0,0,0,0.2)';
                      }
                    }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                        position: 'relative',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: '18px',
                        opacity: isPackageUsed ? 0.72 : 1,
                        }}
                      >
                      <div
                        style={{
                          position: 'absolute',
                          inset: '8px',
                          borderRadius: '28px',
                          border: '2px solid rgba(20, 26, 38, 0.16)',
                          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
                          zIndex: 0,
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          inset: '18px 12px 10px',
                          borderRadius: isPackageUsed ? '22px 22px 26px 26px' : '24px',
                          background: `linear-gradient(180deg, ${pkgInfo.color} 0%, ${pkgInfo.color}f0 55%, ${pkgInfo.color}d8 100%)`,
                          boxShadow: isPackageUsed
                            ? 'inset 0 1px 0 rgba(255,255,255,0.35), 0 10px 18px rgba(0,0,0,0.14)'
                            : 'inset 0 1px 0 rgba(255,255,255,0.45), 0 12px 20px rgba(0,0,0,0.18)',
                          border: '2px solid rgba(22, 28, 40, 0.2)',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          left: '24px',
                          right: '24px',
                          top: isPackageUsed ? '14px' : '20px',
                          height: isPackageUsed ? '50%' : '48%',
                          clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                          transformOrigin: 'top center',
                          transform: isPackageUsed ? 'rotateX(180deg) translateY(-34px)' : 'rotateX(0deg)',
                          transition: 'transform 0.35s ease, height 0.35s ease',
                          background: `linear-gradient(180deg, ${pkgInfo.color} 0%, ${pkgInfo.color}f2 55%, ${pkgInfo.color}d6 100%)`,
                          borderTopLeftRadius: '14px',
                          borderTopRightRadius: '14px',
                          borderLeft: '2px solid rgba(20, 26, 38, 0.14)',
                          borderRight: '2px solid rgba(20, 26, 38, 0.14)',
                          borderTop: '2px solid rgba(20, 26, 38, 0.2)',
                          boxShadow: isPackageUsed
                            ? '0 8px 14px rgba(0,0,0,0.12)'
                            : '0 8px 16px rgba(0,0,0,0.2)',
                          zIndex: 3,
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          left: '12px',
                          right: '12px',
                          bottom: '10px',
                          top: isPackageUsed ? '40%' : '45%',
                          borderBottomLeftRadius: '22px',
                          borderBottomRightRadius: '22px',
                          borderTopLeftRadius: isPackageUsed ? '20px' : '4px',
                          borderTopRightRadius: isPackageUsed ? '20px' : '4px',
                          background: `linear-gradient(180deg, ${pkgInfo.color}f5 0%, ${pkgInfo.color}dd 58%, ${pkgInfo.color}c8 100%)`,
                          border: '2px solid rgba(20, 26, 38, 0.2)',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
                          zIndex: 1,
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          left: '13px',
                          width: 'calc(50% - 13px)',
                          bottom: '10px',
                          top: isPackageUsed ? '40%' : '45%',
                          clipPath: isPackageUsed
                            ? 'polygon(0 0, 100% 0, 74% 34%, 0 34%)'
                            : 'polygon(0 0, 100% 100%, 0 100%)',
                          borderBottomLeftRadius: '22px',
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02))',
                          borderLeft: '1px solid rgba(20, 26, 38, 0.16)',
                          zIndex: 2,
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          right: '13px',
                          width: 'calc(50% - 13px)',
                          bottom: '10px',
                          top: isPackageUsed ? '40%' : '45%',
                          clipPath: isPackageUsed
                            ? 'polygon(0 0, 100% 0, 100% 34%, 26% 34%)'
                            : 'polygon(100% 0, 100% 100%, 0 100%)',
                          borderBottomRightRadius: '22px',
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02))',
                          borderRight: '1px solid rgba(20, 26, 38, 0.16)',
                          zIndex: 2,
                        }}
                      />
                      {isPackageUsed && (
                        <div
                          style={{
                            position: 'absolute',
                            left: '32px',
                            right: '32px',
                            top: '36px',
                            height: '14px',
                            borderTopLeftRadius: '14px',
                            borderTopRightRadius: '14px',
                            borderTop: '2px solid rgba(20, 26, 38, 0.18)',
                            background: 'rgba(255,255,255,0.08)',
                            zIndex: 2,
                          }}
                        />
                      )}
                      <div
                        style={{
                          position: 'absolute',
                          left: 'calc(50% - 1px)',
                          top: isPackageUsed ? '44%' : '49%',
                          width: '2px',
                          height: isPackageUsed ? '24px' : '28px',
                          background: 'rgba(255,255,255,0.45)',
                          boxShadow: '0 0 10px rgba(255,255,255,0.3)',
                          zIndex: 4,
                        }}
                      />
                      <div
                        style={{
                          position: 'relative',
                          zIndex: 5,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: isPackageUsed ? 'flex-end' : 'center',
                          gap: '8px',
                          width: '100%',
                          height: '100%',
                          paddingTop: isPackageUsed ? '54px' : '16px',
                        }}
                      >
                        <Title
                          level={1}
                          style={{
                            ...categoryTextStyle,
                            color: 'white',
                            textShadow: '0 4px 10px rgba(0,0,0,0.25)',
                          }}
                        >
                          {pkgInfo.label}
                        </Title>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{
          position: 'absolute',
          bottom: '30px',
          left: '30px',
          zIndex: 1000,
      }}>
          <Button
              icon={<ArrowLeftOutlined />}
              style={localControlButtonBaseStyle}
              onClick={onBackToIntroScreen}
              title="Về Màn Hình Chính Phần Thi"
          />
      </div>
    </div>
  );
};

const QuestionDisplayScreen = ({
  partTitle, 
  packageNameForTitle, 
  packageData, 
  currentQuestionIndex,
  totalQuestions,
  onNextQuestion,
  onPrevQuestion,
  onBackToPackageSelection,
  teamName, 
  onSelectQuestionByIndex, 
  matchId,
  packageId, 
  teamId,
  scoredQuestions = {},    
}) => {
  const [timeLeft, setTimeLeft] = useState(10);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [timerClickCount, setTimerClickCount] = useState(0);
  const [lastTimerClickTime, setLastTimerClickTime] = useState(0);
  const [answerSelected, setAnswerSelected] = useState(null); 

  const correctAudio = new Audio('/sound/correct-answer.mp3');
  const wrongAudio = new Audio('/sound/wrong-answer.mp3');

  // Calculate questionId based on currentQuestionIndex and the keys in packageData
  const questionKeysInPackage = Object.keys(packageData || {}).filter(key => key.startsWith('question_'));
  // Ensure questionKeysInPackage are sorted if order matters and isn't guaranteed by Object.keys
  // For now, assuming consistent order from Firebase or that keys are like 'question_1', 'question_2'
  // and currentQuestionIndex directly maps. A more robust way might involve sorting if keys are arbitrary.
  const currentQuestionKey = questionKeysInPackage[currentQuestionIndex]; // e.g., "question_1"
  const question = packageData?.[currentQuestionKey];
  const currentScoreRecord = currentQuestionKey ? scoredQuestions?.[currentQuestionKey] : null;

  const localControlButtonBaseStyle = {
    width: '50px', 
    height: '50px',
    fontSize: '18px', 
    fontWeight: 'bold',
    border: '2px solid white',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    color: 'white',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 0px 10px rgba(255, 255, 255, 0.3)',
    borderRadius: '8px',
  };

  const refinedTextButtonStyle = {
    ...localControlButtonBaseStyle, 
    width: 'auto', 
    minWidth: '140px', 
    padding: '0 20px', 
    fontSize: '16px', 
  };

  const disabledRefinedTextButtonStyle = {
    ...refinedTextButtonStyle,
    backgroundColor: 'rgba(100, 100, 100, 0.4)',
    borderColor: 'grey',
    color: 'lightgrey',
    cursor: 'not-allowed',
  };

  const resetTimerAndState = (startTime = 10, autoStart = true) => {
    setTimeLeft(startTime);
    if (currentScoreRecord && typeof currentScoreRecord.score !== 'undefined') {
      setShowAnswer(true);
      setAnswerSelected(Number(currentScoreRecord.score || 0) > 0 ? 'correct' : 'incorrect');
      setIsTimerRunning(false);
    } else {
      setShowAnswer(false);
      setAnswerSelected(null);
      if (startTime > 0 && autoStart) { 
          setIsTimerRunning(true);
      } else {
          setIsTimerRunning(false);
      }
    }
    setTimerClickCount(0);
  };
  
  useEffect(() => {
    // Reset the timer and view state only when the actual question key changes.
    // currentQuestionKey is derived from packageData and currentQuestionIndex.
    // If packageData reference changes but the question at currentQuestionIndex
    // is still the same (i.e., same currentQuestionKey string), this effect will not re-run unnecessarily.
    resetTimerAndState(10, true); 
  }, [currentQuestionKey, currentScoreRecord]); // Depend on the specific question's key

  useEffect(() => {
    if (!isTimerRunning || timeLeft <= 0) {
      if (timeLeft === 0) setIsTimerRunning(false);
      return;
    }
    const intervalId = setInterval(() => {
      setTimeLeft((prevTime) => Math.max(0, prevTime - 1));
    }, 1000);
    return () => clearInterval(intervalId);
  }, [isTimerRunning, timeLeft]);


  const handleTimerClick = () => {
    const now = Date.now();
    if (now - lastTimerClickTime < 500) { 
      setTimerClickCount(prev => prev + 1);
    } else {
      setTimerClickCount(1); 
    }
    setLastTimerClickTime(now);

    if (timerClickCount + 1 >= 3) {
      resetTimerAndState(10, false); 
      setTimerClickCount(0); 
    } else {
      if (timeLeft > 0) {
        setIsTimerRunning(!isTimerRunning);
      }
    }
  };

  const handleAnswerSubmission = async (isCorrect) => {
    if (isCorrect) {
      correctAudio.play().catch((e) => console.warn("Could not play correct sound:", e));
      console.log('Is playing sound:', correctAudio.played.length > 0);
    } else {
      wrongAudio.play().catch((e) => console.warn("Could not play wrong sound:", e));
      console.log('Is playing sound:', wrongAudio.played.length > 0);
    }

    if (answerSelected) {
      message.info("Bạn đã ghi nhận đáp án cho lượt này của đội.");
      return;
    }

    if (currentScoreRecord && typeof currentScoreRecord.score !== 'undefined') {
      message.info("Câu hỏi này đã được chấm điểm trước đó.");
      setShowAnswer(true);
      setAnswerSelected(Number(currentScoreRecord.score || 0) > 0 ? 'correct' : 'incorrect');
      setIsTimerRunning(false);
      return;
    }

    setShowAnswer(true);
    setIsTimerRunning(false);
    setAnswerSelected(isCorrect ? 'correct' : 'incorrect');

    const questionToScoreId = currentQuestionKey; // This is the key of the specific question, e.g., "question_1"

    if (!matchId || !packageId || !questionToScoreId || !teamId) {
      console.warn("MISSING DATA FOR SCORING:", { 
        matchId, 
        packageIdFromProp: packageId, 
        questionKeyForScore: questionToScoreId, 
        teamId 
      });
      message.error("Thiếu thông tin (trận đấu, gói, câu hỏi, hoặc đội) để ghi điểm.");
      return;
    }

    console.log("ATTEMPTING TO RECORD SCORE WITH DATA:", {
        matchId,
        packageIdFromProp: packageId, 
        questionKeyForScore: questionToScoreId, 
        teamId,
        isCorrect
    });

    let currentTeamName = teamId; 
    try {
      const teamDetailsSnapshot = await get(ref(database, `teams/${teamId}`));
      if (teamDetailsSnapshot.exists()) {
        currentTeamName = teamDetailsSnapshot.val().name || teamId;
      }
    } catch (e) {
      console.warn(`Could not fetch name for current team ${teamId}`, e);
    }

    const questionScorePath = `matches/${matchId}/scores/round_1/${packageId}/${questionToScoreId}`;
    console.log("CALCULATED FIREBASE SCORE PATH:", questionScorePath);
    
    if (isCorrect) {
      try {
        const scoreDataToSet = {
          team_id: teamId,
          score: 10,
          team_name: currentTeamName,
          timestamp: serverTimestamp()
        };
        
        await set(ref(database, questionScorePath), scoreDataToSet);
        
        console.log(`Score 10 for team ${teamId} (${currentTeamName}) on ${packageId}/${questionToScoreId} recorded.`);
        message.success(`Đã ghi 10 điểm cho đội "${currentTeamName}".`);
        
      } catch (error) {
        console.error("Error setting score for Part 1 (correct):", error);
        Modal.error({ title: "Lỗi Ghi Điểm Đúng", content: `Không thể ghi điểm. Lỗi: ${error.message}` });
      }
    } else { // isCorrect is false
      try {
        const scoreDataToSet = {
          team_id: teamId,
          score: 0,
          team_name: currentTeamName,
          timestamp: serverTimestamp()
        };

        await set(ref(database, questionScorePath), scoreDataToSet);

        // Corrected log message to use questionToScoreId for consistency
        console.log(`Score 0 for team ${teamId} (${currentTeamName}) on ${packageId}/${questionToScoreId} recorded.`);
        message.info(`Đội "${currentTeamName}" trả lời không chính xác. Điểm cho câu hỏi này được ghi là 0.`);

      } catch (error) {
        console.error("Error setting score for Part 1 (incorrect):", error);
        Modal.error({ title: "Lỗi Ghi Điểm Sai", content: `Không thể ghi điểm. Lỗi: ${error.message}` });
      }
    }
  };
  
  if (!packageData || questionKeysInPackage.length === 0) { 
    return (
      <div style={{ padding: '20px', color: 'white', textAlign: 'center', fontSize: '20px' }}>
        Gói câu hỏi không hợp lệ hoặc không có câu hỏi.
        <Button onClick={onBackToPackageSelection} style={{ marginTop: '20px' }}>Quay lại</Button>
      </div>
    );
  }
  
  if (!question) {
    return (
      <div style={{ padding: '20px', color: 'white', textAlign: 'center', fontSize: '20px' }}>
        Không tìm thấy câu hỏi. Vui lòng thử lại.
        <Button onClick={onBackToPackageSelection} style={{ marginTop: '20px' }}>Quay lại</Button>
      </div>
    );
  }

  const headerStyle = {
    width: '100%',
    backgroundColor: '#d13c30',
    minHeight: '80px',
    padding: '10px 30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
    position: 'relative',
    zIndex: 20,
  };

  const headerTitleStyle = {
    margin: 0,
    color: 'white',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontSize: 'clamp(20px, 3.5vw, 36px)',
    fontWeight: 'bold',
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)',
  };
  
  const mainQuizContentStyle = { 
    flex: 1,
    display: 'flex',
    flexDirection: 'column', 
    position: 'relative', 
    padding: '0px', 
    overflow: 'hidden', 
  };

  const quizContainerStyle = { 
    display: 'flex',
    padding: '20px',
    gap: '20px', 
    height: '100%', 
    flexGrow: 1,
  };

  const quizContentAreaStyle = { 
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '15px', 
  };
  
  const topControlsStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    gap: '10px',
    flexWrap: 'wrap', 
    minHeight: '60px',
  };

  const controlBoxBaseStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    border: '2px solid #d13c30',
    borderRadius: '10px',
    padding: '0 15px',
    fontSize: 'clamp(20px, 2.5vw, 24px)',
    fontWeight: 'bold',
    color: '#d13c30',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    textAlign: 'center',
    display: 'flex', 
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  };
  
  const timerStyle = { ...controlBoxBaseStyle, minWidth: '150px', cursor: 'pointer', fontSize: 'clamp(22px, 3vw, 28px)' };
  const teamStyle = { ...controlBoxBaseStyle, flexGrow: 2, fontSize: 'clamp(20px, 2.5vw, 24px)'};
  // const teamStyle = { ...controlBoxBaseStyle, flexGrow: 2, minWidth: '250px', maxWidth: '400px', fontSize: 'clamp(20px, 2.5vw, 24px)'};

  const resultButtonsContainerStyle = { display: 'flex', gap: '10px', height: '100%' };
  
  const getResultButtonStyle = (type, isHovered) => {
    let style = {
      ...controlBoxBaseStyle,
      cursor: 'pointer',
      fontSize: 'clamp(18px, 2.2vw, 22px)',
      minWidth: '100px',
      transition: 'background-color 0.2s ease, color 0.2s ease',
    };
    if (type === 'correct') {
      style.borderColor = '#28a745';
      style.color = '#28a745';
      if (answerSelected === 'correct') {
        style.backgroundColor = '#28a745'; 
        style.color = 'white';
      } else if (isHovered && !answerSelected) {
        style.backgroundColor = 'rgba(40, 167, 69, 0.15)';
      }
    } else { // incorrect
      style.borderColor = '#d13c30';
      style.color = '#d13c30';
      if (answerSelected === 'incorrect') {
        style.backgroundColor = '#d13c30'; 
        style.color = 'white';
      } else if (isHovered && !answerSelected) {
        style.backgroundColor = 'rgba(209, 60, 48, 0.1)';
      }
    }
    return style;
  };
  
  const questionDisplayBoxStyle = { 
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)', 
    border: '2px solid #d13c30',
    borderRadius: '10px',
    padding: '20px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    overflowY: 'auto',
    color: '#333',
    display: 'flex',
    flexDirection: 'column', 
  };

  const questionTitleStyle = { 
    color: '#d13c30',
    fontSize: 'clamp(20px, 2.5vw, 24px)',
    fontWeight: 'bold',
    textAlign: 'left',   
    flexShrink: 0, 
    marginBottom: '15px',
  };
  
  const questionTextWrapperStyle = { // Wrapper for question text paragraph
    flexGrow: 1, // Takes up available space to help center vertically
    width: '100%',
    display: 'flex',
    justifyContent: 'center', // Horizontally centers the paragraph
    alignItems: 'center',     // Vertically centers the paragraph in this wrapper
    padding: '10px 0',       // Vertical padding around text
  };

  const questionTextStyle = { 
    fontSize: 'clamp(26px, 3.8vw, 40px)', // Updated font size to match answerTextStyle
    lineHeight: 1.5, // You might want to adjust lineHeight if the new size causes overlap or too much/little space
    textAlign: 'center', // Centers the text lines within the paragraph
    maxWidth: '90%',     // Prevents very long lines
    color: '#333',
    fontWeight: 'bold', // Normal weight for question text
  };

  const mediaWrapperStyle = { // Wrapper for media content
    flexGrow: 1, // Shares space with questionTextWrapperStyle if both are 1
                 // Consider making this flexShrink: 0 and giving it a more defined space if needed
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '20px', // Increased space above media
    maxHeight: '50vh', // Media can be up to 50% of viewport height
    minHeight: '200px', // Ensure media area has some minimum height if media is small or text is short
  };

  const prominentMediaStyle = { // For img, video
    maxWidth: '100%',   
    maxHeight: '100%', // Fill the mediaWrapper's height (up to 50vh)
    objectFit: 'contain',
    borderRadius: '8px',
    display: 'block', // Good for img/video
    backgroundColor: 'rgba(0,0,0,0.05)', 
  };

  const iframeMediaStyle = { // For YouTube
    width: '100%', 
    aspectRatio: '16/9',
    maxHeight: '100%', // Fill the mediaWrapper's height
    border: 'none',
    borderRadius: '8px',
    display: 'block',
  };

  const answerRevealBoxStyle = {
    flex: 1, 
    backgroundColor: 'rgba(255, 255, 255, 0.9)', 
    border: '2px solid #d13c30',      
    borderRadius: '10px',
    padding: '20px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)', 
    overflowY: 'auto',
    display: 'flex', 
    flexDirection: 'column', // Title and Answer Paragraph will stack vertically
    color: '#333', 
  };

  const answerTextStyle = { 
    flexGrow: 1, // Allow the paragraph to grow and take available vertical space
    display: 'flex', // Use flex to center the text content within the paragraph
    justifyContent: 'center', // Center horizontally
    alignItems: 'center', // Center vertically
    fontSize: 'clamp(26px, 3.8vw, 40px)', 
    lineHeight: 1.5, 
    color: '#d13c30', 
    fontWeight: 'bold', 
    textAlign: 'center', // For multi-line text centering within the text block
    width: '100%',
    textShadow: '1px 1px 3px rgba(0,0,0,0.2)', 
    marginTop: '10px', // Adjust margin as needed from the title
  };
  
  const numberButtonsContainerStyle = { 
    display: 'flex',
    flexDirection: 'column',
    gap: '8px', 
    width: '60px', 
  };
  
  const numberButtonStyleBase = {
    width: '100%', 
    height: '45px', 
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    border: '2px solid #d13c30',
    borderRadius: '8px', 
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 'clamp(16px, 2vw, 18px)',
    fontWeight: 'bold',
    color: '#d13c30',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  };
  const activeNumberButtonStyle = {
    ...numberButtonStyleBase,
    backgroundColor: '#1f4fa3',
    borderColor: '#ffffff',
    color: 'white',
  };
  const answeredNumberButtonStyle = {
    ...numberButtonStyleBase,
    backgroundColor: 'rgba(100, 100, 100, 0.45)',
    borderColor: '#9a9a9a',
    color: 'rgba(255,255,255,0.9)',
    cursor: 'not-allowed',
  };
  const answeredCorrectNumberButtonStyle = {
    ...numberButtonStyleBase,
    backgroundColor: '#28a745',
    borderColor: '#28a745',
    color: 'white',
    cursor: 'not-allowed',
  };
  const answeredIncorrectNumberButtonStyle = {
    ...numberButtonStyleBase,
    backgroundColor: '#d13c30',
    borderColor: '#d13c30',
    color: 'white',
    cursor: 'not-allowed',
  };

  const bottomNavContainerStyle = { 
    padding: '10px 0px', 
    display: 'flex',
    justifyContent: 'center', 
    gap: '15px',
  };


  const formattedTime = `${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(2, '0')}`;
  const youtubeEmbedUrl = question?.media?.type === 'youtube' && question?.media?.url ? getYoutubeEmbedUrl(question.media.url) : null;
  const shouldShowMedia = question?.media && question.media.url && question.media.type !== 'none';

  const [hoveredButton, setHoveredButton] = useState(null);

  // DEBUG LOG
  console.log(
    `[QDS Render Debug] Question: ${currentQuestionIndex + 1}, Package: ${packageNameForTitle}`,
    `showAnswer: ${showAnswer}`,
    `Should display: ${showAnswer ? 'ANSWER' : 'QUESTION'}`,
    `Actual answer data: '${question?.answer}'`,
    `Answer selected state: ${answerSelected}`
  );

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', color: 'white', position: 'relative' }}>
      {/* Header */}
      <div style={headerStyle}>
        <Title level={2} style={headerTitleStyle}>{partTitle}</Title>
      </div>

      {/* Main Quiz Area */}
      <div style={mainQuizContentStyle}>
        <div style={quizContainerStyle}>
          {/* Left Side: Quiz Content */}
          <div style={quizContentAreaStyle}>
            <div style={topControlsStyle}>
              <div style={timerStyle} onClick={handleTimerClick} title="Nhấn để Dừng/Chạy, 3 lần nhanh để Reset">
                {formattedTime} {isTimerRunning ? <PauseCircleOutlined style={{marginLeft: 5}}/> : <PlayCircleOutlined style={{marginLeft: 5}}/>}
              </div>
              <div style={teamStyle}>{teamName || 'Đội Trả Lời'}</div>
              <div style={resultButtonsContainerStyle}>
                <Button 
                  style={getResultButtonStyle('correct', hoveredButton === 'correct')} 
                  onClick={() => handleAnswerSubmission(true)} 
                  icon={<CheckCircleOutlined />} 
                  disabled={!!answerSelected}
                  onMouseEnter={() => setHoveredButton('correct')}
                  onMouseLeave={() => setHoveredButton(null)}
                >
                  ĐÚNG
                </Button>
                <Button 
                  style={getResultButtonStyle('incorrect', hoveredButton === 'incorrect')} 
                  onClick={() => handleAnswerSubmission(false)} 
                  icon={<CloseCircleOutlined />} 
                  disabled={!!answerSelected}
                  onMouseEnter={() => setHoveredButton('incorrect')}
                  onMouseLeave={() => setHoveredButton(null)}
                >
                  SAI
                </Button>
              </div>
            </div>

            {!showAnswer ? (
              <div style={questionDisplayBoxStyle}> 
                <Typography.Title 
                  level={4} 
                  style={questionTitleStyle}
                >
                  {`${packageNameForTitle} - Câu hỏi ${currentQuestionIndex + 1}`}
                </Typography.Title>

                <div style={questionTextWrapperStyle}> 
                  <Typography.Paragraph style={questionTextStyle}>
                    {question.question_text || question.question}
                  </Typography.Paragraph>
                </div>

                {shouldShowMedia && (
                  <div style={mediaWrapperStyle}> 
                    {question.media.type === 'image' && <img src={question.media.url} alt="media" style={prominentMediaStyle} />}
                    {question.media.type === 'audio' && <audio controls src={question.media.url} style={{ width: '100%', marginTop: '10px' }} />}
                    {question.media.type === 'video' && 
                      <video controls style={prominentMediaStyle}>
                          <source src={question.media.url} type="video/mp4" />
                          Trình duyệt của bạn không hỗ trợ thẻ video.
                      </video>
                    }
                    {question.media.type === 'youtube' && youtubeEmbedUrl && (
                      <iframe
                        style={iframeMediaStyle}
                        src={youtubeEmbedUrl}
                        title="YouTube video player"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      ></iframe>
                    )}
                    {question.media.type === 'youtube' && !youtubeEmbedUrl && question.media.url && (
                       <Text type="secondary" style={{display: 'block', textAlign: 'center', marginTop: '10px', color: '#ffccc7'}}>
                          Link YouTube không hợp lệ hoặc không thể hiển thị.
                       </Text>
                    )}
                  </div>
                )}
              </div>
            ) : (
              // Answer Display Area
              <div style={answerRevealBoxStyle}>
                <Typography.Title 
                  level={4} 
                  style={{...questionTitleStyle, color: '#d13c30'}} // Title remains top-left
                >
                  {`${packageNameForTitle} - Câu hỏi ${currentQuestionIndex + 1}: Đáp Án`}
                </Typography.Title>

                {/* This paragraph will now grow and center its content */}
                <Typography.Paragraph style={answerTextStyle}>
                  {(question.answer !== undefined && question.answer !== null && String(question.answer).trim() !== '') ? question.answer : '(Không có đáp án được cung cấp)'}
                </Typography.Paragraph>
              </div>
            )}
             <div style={bottomNavContainerStyle}>
                <Button 
                    icon={<LeftOutlined />} 
                    onClick={onPrevQuestion} 
                    disabled={currentQuestionIndex === 0} 
                    style={currentQuestionIndex === 0 ? disabledRefinedTextButtonStyle : refinedTextButtonStyle}
                >
                    Câu Trước
                </Button>
                <Button 
                    icon={<RightOutlined />} 
                    onClick={onNextQuestion} 
                    disabled={currentQuestionIndex >= totalQuestions - 1} 
                    style={currentQuestionIndex >= totalQuestions - 1 ? disabledRefinedTextButtonStyle : refinedTextButtonStyle}
                >
                    Câu Tiếp
                </Button>
            </div>
          </div>

          {/* Right Side: Number Buttons */}
            <div style={numberButtonsContainerStyle}>
              {questionKeysInPackage.map((qId, index) => ( 
              (() => {
                const questionScoreRecord = scoredQuestions?.[qId];
                const isAnswered = !!questionScoreRecord;
                const isCurrent = index === currentQuestionIndex;
                const isCorrect = Number(questionScoreRecord?.score || 0) > 0;
                const buttonStyle = isCurrent
                  ? activeNumberButtonStyle
                  : (isAnswered
                      ? (isCorrect ? answeredCorrectNumberButtonStyle : answeredIncorrectNumberButtonStyle)
                      : numberButtonStyleBase);
                return (
                <Button // Changed to Button for easier click handling
                  key={qId}
                  style={buttonStyle}
                  onClick={() => {
                    if (isAnswered) return;
                    onSelectQuestionByIndex(index);
                  }} // Navigate on click
                  disabled={isAnswered}
                >
                  {index + 1}
                </Button>
                );
              })()
              ))}
             {totalQuestions > questionKeysInPackage.length && questionKeysInPackage.length >= 8 && ( // Show ellipsis if more than 8 and we've shown 8
                <div style={{...numberButtonStyleBase, height: 'auto', padding: '5px', fontSize: '12px', cursor: 'default'}}>...</div>
            )}
          </div>
        </div>
      </div>
      {/* New Back Button at the bottom left */}
      <div style={{
          position: 'absolute',
          bottom: '30px',
          left: '30px',
          zIndex: 1000, 
      }}>
          <Button
              icon={<ArrowLeftOutlined />}
              style={localControlButtonBaseStyle}
              onClick={onBackToPackageSelection}
              title="Về Chọn Gói"
          />
      </div>
    </div>
  );
};

// Modal thể lệ
const RulesModal = ({ visible, onClose, rulesContent, onConfirmStart }) => (
  <Modal
    title="Thể Lệ Phần Thi 1: Tiên phong"
    open={visible}
    onCancel={onClose}
    width="82vw"
    centered
    destroyOnClose
    styles={{ body: { padding: '12px 16px' } }}
    footer={[
      <Button key="back" onClick={onClose} style={{fontSize: '16px', padding: '5px 20px', height: 'auto'}}>
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


// --- Component Chính ContestPart1 ---
function ContestPart1() {
  const { matchId } = useParams();
  const navigate = useNavigate();

  const [currentView, setCurrentView] = useState('intro'); 
  const [matchDataForPart, setMatchDataForPart] = useState(null);
  const [round1Data, setRound1Data] = useState(null);
  const [teamsInMatch, setTeamsInMatch] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorLoadingPart, setErrorLoadingPart] = useState(null);
  
  const [rulesVisible, setRulesVisible] = useState(false);
  const [rulesHtmlContent, setRulesHtmlContent] = useState('');
  const [loadingRules, setLoadingRules] = useState(false);

  const [selectedTeamForPackage, setSelectedTeamForPackage] = useState(null);
  const [usedPackages, setUsedPackages] = useState({});

  const controlButtonBaseStyle = {
    width: '50px',
    height: '50px',
    fontSize: '18px',
    fontWeight: 'bold',
    border: '2px solid white',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    color: 'white',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 0px 10px rgba(255, 255, 255, 0.3)',
    borderRadius: '8px',
  };

  const activeButtonStyle = {
    ...controlButtonBaseStyle,
    backgroundColor: '#FFC107',
    borderColor: '#FFC107',
    color: 'white',
  };

  const requestFullScreen = useCallback(() => {
    const elem = document.documentElement;
    if (!document.fullscreenElement) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(err => {
          console.warn(`Yêu cầu full-screen bị từ chối hoặc lỗi: ${err.message}`);
        });
      } else if (elem.mozRequestFullScreen) { elem.mozRequestFullScreen(); }
      else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen(); }
      else if (elem.msRequestFullscreen) { elem.msRequestFullscreen(); }
    }
  }, []);

  useEffect(() => {
    console.log('[ContestPart1] Data-Fetching useEffect triggered. matchId:', matchId);
    if (!matchId) {
      console.error('[ContestPart1] No matchId provided.');
      setErrorLoadingPart("ID trận đấu không hợp lệ.");
      setLoading(false);
      setRound1Data({}); 
      setTeamsInMatch([]);
      return;
    }
    setLoading(true);
    setErrorLoadingPart(null);
    const matchRef = ref(database, `matches/${matchId}`);
    const teamsRef = ref(database, 'teams'); 

    let matchDataListener;
    let teamsDataCache = {}; 
    let latestMatchData = null;

    const syncTeamsInMatch = (matchData, allTeamsData) => {
      if (!matchData?.team_ids || !Array.isArray(matchData.team_ids)) {
        setTeamsInMatch([]);
        return;
      }

      if (!allTeamsData || Object.keys(allTeamsData).length === 0) {
        return;
      }

      const currentTeams = matchData.team_ids
        .map(teamId => allTeamsData[teamId] ? { ...allTeamsData[teamId], id: teamId } : null)
        .filter(team => team !== null);

      setTeamsInMatch(currentTeams);
    };

    const teamsListener = onValue(teamsRef, (snapshot) => {
        teamsDataCache = snapshot.val() || {};
        console.log('[ContestPart1] All teams data fetched:', teamsDataCache);
        syncTeamsInMatch(latestMatchData, teamsDataCache);
    }, (error) => {
        console.error("[ContestPart1] Firebase read all teams failed:", error);
    });

    matchDataListener = onValue(matchRef, (snapshot) => {
      const data = snapshot.val();
      console.log(`[ContestPart1] Firebase snapshot data for matchId '${matchId}':`, data);

      if (data && typeof data === 'object') {
        latestMatchData = data;
        setMatchDataForPart(data); // Store full match data
        setUsedPackages(data.live_state?.round_1?.used_packages || {});

        const currentMatchRound1Data = data.round_1;
        if (currentMatchRound1Data && typeof currentMatchRound1Data === 'object' && Object.keys(currentMatchRound1Data).length > 0) {
          setRound1Data(currentMatchRound1Data);
        } else {
          setRound1Data({}); 
        }

        syncTeamsInMatch(data, teamsDataCache);
      } else {
        latestMatchData = null;
        setErrorLoadingPart(`Trận đấu với ID "${matchId}" không tồn tại.`);
        setRound1Data({}); 
        setTeamsInMatch([]);
      }
      setLoading(false);
    }, (error) => {
      setErrorLoadingPart("Lỗi tải dữ liệu Phần Thi 1 từ Firebase.");
      setRound1Data({}); 
      setTeamsInMatch([]);
      setLoading(false);
    });

    return () => {
      if (matchRef && matchDataListener) {
        off(matchRef, 'value', matchDataListener);
      }
      if (teamsRef && teamsListener) { 
          off(teamsRef, 'value', teamsListener);
      }
    };
  }, [matchId]); // Only matchId as primary dependency for fetching. matchDataForPart is not needed here.
  
  const fetchRulesContent = async () => {
    setLoadingRules(true);
    try {
      // Đường dẫn tới file HTML trong thư mục public
      const response = await fetch(`/rules/rules_contest_1.html?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const htmlText = await response.text();
      setRulesHtmlContent(htmlText);
    } catch (error) {
      console.error("Error fetching rules HTML:", error);
      setRulesHtmlContent("<p>Không thể tải được nội dung thể lệ. Vui lòng thử lại sau.</p>");
    }
    setLoadingRules(false);
  };

  const handleBackToLauncher = () => {
    if (matchId) {
      navigate(`/organizer/contest/${matchId}`);
    } else {
      navigate('/organizer'); 
    }
  };

  const handleShowRules = () => {
    if (!rulesHtmlContent && !loadingRules) { // Fetch chỉ khi chưa có và không đang fetch
        fetchRulesContent();
    }
    setRulesVisible(true);
  };
  const handleCloseRules = () => setRulesVisible(false);
  
  const handleShowScore = () => {
    navigate(`/organizer/contest/${matchId}/part1/scoreboard`);
  };

  const handleStartPartOrPackageSelection = () => { 
    console.log('[ContestPart1] handleStartPartOrPackageSelection called.');
    console.log('[ContestPart1] Value of round1Data inside handleStartPartOrPackageSelection:', round1Data);
    
    if (!loading && round1Data && typeof round1Data === 'object' && Object.keys(round1Data).length > 0) {
        console.log('[ContestPart1] Packages found. Setting currentView to "packageSelection".');
        setCurrentView('packageSelection');
        // Reset đội đã chọn khi vào màn hình chọn gói
        setSelectedTeamForPackage(null); 
    } else {
        console.log('[ContestPart1] No packages or still loading. Showing warning.');
        Modal.warning({
            title: "Chưa có gói câu hỏi",
            content: "Phần thi này hiện chưa có gói câu hỏi nào được cấu hình hoặc dữ liệu đang tải.",
            okText: "Đã Hiểu"
        });
        if (loading) return;
        setCurrentView('intro'); 
    }
  };

  const handleStartFromRulesModal = () => { 
    setRulesVisible(false); 
    handleStartPartOrPackageSelection(); 
  };

  // Hàm mới để xử lý việc chọn đội cho gói
  const handleSelectTeamForPackage = (teamId) => {
    setSelectedTeamForPackage(teamId);
    console.log(`[ContestPart1] Team selected for package: ${teamId}`);
  };
  
  const handleSelectPackage = async (packageId, teamIdForPackage) => {
    if (!teamIdForPackage && teamsInMatch && teamsInMatch.length > 0) {
        Modal.error({ title: "Chưa chọn đội", content: "Vui lòng chọn một đội thi trước khi mở gói câu hỏi."});
        return;
    }
    if (usedPackages?.[packageId]) {
        Modal.info({ title: "Gói đã được chọn", content: "Gói câu hỏi này đã được sử dụng và không thể chọn lại." });
        return;
    }
    const selectedTeam = teamsInMatch.find(team => team.id === teamIdForPackage);
    try {
      await update(ref(database, `matches/${matchId}/live_state/round_1`), {
        selected_package_id: packageId,
        selected_team_id: teamIdForPackage,
        selected_team_name: selectedTeam?.name || '',
        [`used_packages/${packageId}`]: {
          team_id: teamIdForPackage,
          team_name: selectedTeam?.name || '',
          locked_at: Date.now(),
        }
      });
    } catch (error) {
      Modal.error({ title: "Không thể mở gói", content: `Lỗi lưu trạng thái gói câu hỏi: ${error.message}` });
      return;
    }
    setUsedPackages((prev) => ({
      ...prev,
      [packageId]: {
        team_id: teamIdForPackage,
        team_name: selectedTeam?.name || '',
        locked_at: Date.now(),
      }
    }));
    setSelectedPackageId(packageId);
    setSelectedTeamForPackage(teamIdForPackage);
    setCurrentQuestionIndex(0);
    setCurrentView('questionDisplay');
    console.log(`[ContestPart1] Package ${packageId} selected by team ${teamIdForPackage}`);
  };

  const handleNextQuestion = () => {
    // Corrected logic: access questions from round1Data[selectedPackageId]
    const currentPackageQuestions = round1Data?.[selectedPackageId];
    if (currentPackageQuestions) {
        const questionKeys = Object.keys(currentPackageQuestions).filter(key => key.startsWith('question_'));
        if (currentQuestionIndex < questionKeys.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        }
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
        setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSelectQuestionByIndex = (index) => {
    const currentPackageQuestions = round1Data?.[selectedPackageId];
    if (currentPackageQuestions) {
        const questionKeys = Object.keys(currentPackageQuestions).filter(key => key.startsWith('question_'));
        if (index >= 0 && index < questionKeys.length) {
            setCurrentQuestionIndex(index);
        }
    }
  };
  
  const renderMainContent = () => {
    if (loading) return <Spin size="large" tip="Đang tải dữ liệu..." style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)'}}/>;
    if (errorLoadingPart) return (
        <div style={{ textAlign: 'center', padding: '50px', backgroundColor: 'rgba(255,0,0,0.2)', borderRadius: '10px', color: 'white', margin: 'auto'}}>
            <Title level={3} style={{color: 'white'}}>Đã xảy ra lỗi</Title>
            <Text style={{color: 'white', fontSize: '18px'}}>{errorLoadingPart}</Text>
            <Button onClick={() => navigate('/organizer')} style={{marginTop: 20}}>Về trang chọn trận</Button>
        </div>
    );

    switch (currentView) {
      case 'packageSelection':
        return <PackageSelectionScreen 
                    partTitle={PART_TITLE}
                    packages={round1Data} 
                    teams={teamsInMatch}
                    onSelectPackage={handleSelectPackage}
                    onBackToIntroScreen={() => setCurrentView('intro')}
                    selectedTeamIdForPackage={selectedTeamForPackage}
                    onSelectTeamForPackage={handleSelectTeamForPackage}
                    usedPackages={usedPackages}
                />;
      case 'questionDisplay':
            const selectedPkgData = round1Data?.[selectedPackageId];
            
            if (!selectedPkgData || Object.keys(selectedPkgData).filter(k => k.startsWith('question_')).length === 0) {
                Modal.error({
                    title: "Lỗi Gói Câu Hỏi",
                    content: "Gói câu hỏi đã chọn không hợp lệ hoặc không có câu hỏi. Vui lòng quay lại.",
                    onOk: () => setCurrentView('packageSelection')
                });
                return <Spin tip="Đang chuyển hướng..." style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)'}}/>; 
            }

            const totalQsInPackage = Object.keys(selectedPkgData).filter(key => key.startsWith('question_')).length;
            const currentTeam = teamsInMatch.find(team => team.id === selectedTeamForPackage);
            const teamNameToDisplay = currentTeam ? currentTeam.name : "N/A";
            const scoredQuestionsForPackage = matchDataForPart?.scores?.round_1?.[selectedPackageId] || {};
            
            const pkgLabelForTitle = selectedPackageId 
                ? selectedPackageId.replace('package_', 'Gói ').replace('_', ' ') 
                : 'Gói Câu Hỏi';

            return <QuestionDisplayScreen 
                        partTitle="PHẦN THI TIÊN PHONG"
                        packageNameForTitle={pkgLabelForTitle.toUpperCase()}
                        packageData={selectedPkgData} 
                        currentQuestionIndex={currentQuestionIndex}
                        totalQuestions={totalQsInPackage}
                        onNextQuestion={handleNextQuestion}
                        onPrevQuestion={handlePrevQuestion}
                        onBackToPackageSelection={() => {
                            setCurrentView('packageSelection');
                            // setSelectedTeamForPackage(null); // Keep team selected for package screen potentially
                        }}
                        teamName={teamNameToDisplay}
                        onSelectQuestionByIndex={handleSelectQuestionByIndex} // Pass new callback
                        // Props for scoring
                        matchId={matchId}
                        packageId={selectedPackageId}
                        teamId={selectedTeamForPackage}
                        scoredQuestions={scoredQuestionsForPackage}
                    />;
      case 'intro': 
      default:
        return null; 
    }
  };

  return (
    <div 
      style={{
        width: '100vw',
        height: '100vh',
        backgroundImage: `url(${commonPartBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        flexDirection: 'column', // Changed to column for header + content flow
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Conditional rendering for the Intro screen's main title & back button */}
      {currentView === 'intro' && (
        <>
          {/* Back button is removed from here */}
          {/* This div is for the large centered title specific to the intro screen */}
          <div style={{
              width: '100%', // Take full width
              flexGrow: 1, // Allow it to take space to center content vertically
              display: 'flex', alignItems: 'center',
              flexDirection: 'column',
              justifyContent: 'center',
              pointerEvents: 'none', // So it doesn't interfere with buttons below
              zIndex: 10, // Ensure it's behind controls if they overlap, but above background
          }}>
            <div
              style={{
                position: 'absolute',
                top: '28px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '24px',
                flexWrap: 'wrap',
                padding: '0 24px',
                width: 'min(100%, 1200px)',
              }}
            >
              <img
                src={logo1}
                alt="Logo 1"
                style={{
                  height: 'clamp(76px, 10vw, 130px)',
                  width: 'auto',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 10px 22px rgba(0, 0, 0, 0.28))',
                }}
              />
              <img
                src={logo2}
                alt="Logo 2"
                style={{
                  height: 'clamp(76px, 10vw, 130px)',
                  width: 'auto',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 10px 22px rgba(0, 0, 0, 0.28))',
                }}
              />
            </div>
            <Title level={1} style={{
                color: '#FFF7D6', textAlign: 'center', textShadow: '0 0 18px rgba(10, 40, 120, 0.45), 3px 3px 12px rgba(0, 0, 0, 0.35)', fontWeight: 'bold',
                fontSize: 'clamp(3rem, 6vw, 6rem)', margin: 0, padding: '0 20px', lineHeight: '1.3',
            }}>
                PHẦN THI <br /> "TIÊN PHONG"
            </Title>
          </div>
        </>
      )}

      {/* Container for view-specific content (PackageSelection, QuestionDisplay) */}
      {/* This div will now house views that manage their own full layout (header + content) */}
      {currentView !== 'intro' && (
         <div 
            style={{
              width: '100%',
              height: '100%', // Ensure it takes full space when not intro
              display: 'flex', // These views (PackageSelection, QuestionDisplay) are flex containers themselves
              flexDirection: 'column',
            }}
          >
            {renderMainContent()}
          </div>
      )}


      {/* Control buttons (S, R, C) only for 'intro' view */}
      {currentView === 'intro' && (
          <>
            <div style={{
                position: 'absolute',
                bottom: '30px',
                right: '30px',
                display: 'flex',
                gap: '10px',
                zIndex: 1000,
            }}>
                <Button
                    icon={<TrophyOutlined />}
                    style={controlButtonBaseStyle}
                    onClick={handleShowScore}
                    title={`Xem Điểm ${PART_TITLE}`}
                    disabled={loading}
                />
                <Button
                    icon={<BookOutlined />}
                    style={controlButtonBaseStyle}
                    onClick={handleShowRules}
                    title={`Xem Thể Lệ ${PART_TITLE}`}
                    disabled={loading}
                />
                <Button
                    style={{
                        ...controlButtonBaseStyle,
                        ...((!loading && round1Data && Object.keys(round1Data || {}).length > 0) ? activeButtonStyle : {})
                    }}
                    onClick={handleStartPartOrPackageSelection}
                    title={`Bắt Đầu ${PART_TITLE}`}
                    disabled={loading || !round1Data || Object.keys(round1Data || {}).length === 0}
                >
                    <PlayCircleOutlined />
                </Button>
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
                    onClick={handleBackToLauncher}
                    title="Về Màn Hình Chính"
                />
            </div>
          </>
      )}
      
      <RulesModal 
        visible={rulesVisible} 
        onClose={handleCloseRules} 
        rulesContent={loadingRules ? "<p>Đang tải thể lệ...</p>" : rulesHtmlContent}
        onConfirmStart={handleStartFromRulesModal}
      />
    </div>
  );
}

export default ContestPart1; 
