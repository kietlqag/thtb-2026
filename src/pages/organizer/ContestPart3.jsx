import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button, message, Space, Typography, Radio, Spin, Modal, Row, Col, App, theme } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { database } from '../../services/firebase/config';
import { ref, onValue, off, update as firebaseUpdate, get, set, serverTimestamp, runTransaction } from 'firebase/database';
import commonPartBackground from '../../assets/images/contest_background.png';
import logo1 from '../../assets/images/logo1.png';
import logo2 from '../../assets/images/logo2.png';
import {
    ArrowLeftOutlined,
    PlayCircleOutlined,
    RightOutlined,
    LeftOutlined,
    CheckOutlined,
    CloseOutlined,
    SoundOutlined,
    PauseCircleOutlined,
    RedoOutlined,
    EyeOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    BellOutlined,
    VideoCameraOutlined,
    FileImageOutlined,
    TableOutlined,
    ReloadOutlined,
    HomeOutlined,
    TrophyOutlined,
    BookOutlined,
    LockOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const packageColors = ['#d32f2f', '#303f9f', '#00796b', '#fbc02d', '#5d4037', '#455a64']; // Red, Indigo, Teal, Yellow, Brown, Blue Grey
const romanNumerals = ["I", "II", "III", "IV", "V", "VI"];

// Helper to get YouTube Embed URL (copied from Part 1)
const getYoutubeEmbedUrl = (url) => {
    if (!url) return null;
    let videoId = '';
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
            videoId = urlObj.searchParams.get('v');
        } else if (urlObj.hostname === 'youtu.be') {
            videoId = urlObj.pathname.slice(1);
        }
        return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0` : null; // autoplay=0 by default
    } catch (e) {
        console.error("Invalid YouTube URL:", url, e);
        return null;
    }
};

const QuestionDisplayScreen = ({
    partTitle,
    selectedPackageData, // This is expected to be an object with a single question key if coming from Jigsaw
    selectedPackageName, // e.g., "Gói X - Mảnh Y" or just "Gói X"
    onBackToPackageSelection,
    matchId,
    roundId,
    packageId, // The ID of the overall package (e.g., package_1 of round_3)
    teamsInMatch,
    currentAnsweringTeamId,
    onScoreUpdate,
    isJigsawQuestion, // True if this question is a piece of the jigsaw
    jigsawQuestionKey, // The specific key of the jigsaw question (e.g., question_1)
    onJigsawQuestionAnsweredCallback,
    initialQuestionKey, // This will be the jigsawQuestionKey
    selectedTeamIdForPackage,
    onSelectTeamForPackage, 
}) => {
    // State from Part 1, adapted
    const [timeLeft, setTimeLeft] = useState(10);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [showAnswer, setShowAnswer] = useState(false);
    const [timerClickCount, setTimerClickCount] = useState(0);
    const [lastTimerClickTime, setLastTimerClickTime] = useState(0);
    const [scoreRecorded, setScoreRecorded] = useState(false); 
    const [hoveredButton, setHoveredButton] = useState(null); 
    const [isStealPhase, setIsStealPhase] = useState(false);
    const [selectedStealTeamId, setSelectedStealTeamId] = useState(null);

    const correctAudio = new Audio('/sound/correct-answer.mp3');
    const wrongAudio = new Audio('/sound/wrong-answer.mp3');

    const question = useMemo(() => {
        if (!selectedPackageData || !initialQuestionKey) return null;
        // If selectedPackageData is the full package, get the specific question
        if (selectedPackageData[initialQuestionKey]) {
            return selectedPackageData[initialQuestionKey];
        }
        // If selectedPackageData *is* the single question object (e.g. { question_1: {...} } was processed by parent)
        // This case might occur if the parent component pre-selects the question object.
        // However, the typical flow is that `selectedPackageData` is the package, and `initialQuestionKey` points to the question.
        // Let's assume the primary way is selectedPackageData[initialQuestionKey]
        console.warn("[QuestionDisplayScreen] Fallback: initialQuestionKey not found directly in selectedPackageData. Check data structure.", selectedPackageData, initialQuestionKey);
        return null; // Or handle other structures if necessary
    }, [selectedPackageData, initialQuestionKey]);

    const currentQuestionKeyForScoring = initialQuestionKey; 

    const resetTimerAndState = (startTime = 10, autoStart = true) => {
        setTimeLeft(startTime);
        setShowAnswer(false);
        setScoreRecorded(false); // Allow re-scoring if question changes, though Part 3 is usually one-shot
        setTimerClickCount(0);
        setIsStealPhase(false);
        setSelectedStealTeamId(null);
        if (question && startTime > 0 && autoStart && !showAnswer) { 
            setIsTimerRunning(true);
        } else {
            setIsTimerRunning(false);
        }
    };
    
    useEffect(() => {
        resetTimerAndState(10, true); 
    }, [initialQuestionKey, packageId]); 

    useEffect(() => {
        if (!isTimerRunning || timeLeft <= 0) {
          if (timeLeft <= 0) setIsTimerRunning(false); 
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
          if (timeLeft > 0 && question) { // Ensure question is loaded
            setIsTimerRunning(!isTimerRunning);
          }
        }
    };

    const handleScore = async (correctChoice) => { // Renamed parameter for clarity
        const activeAnsweringTeamId = isStealPhase ? selectedStealTeamId : currentAnsweringTeamId;
        if (correctChoice) {
            correctAudio.play().catch((e) => console.warn("Could not play correct sound:", e));
            console.log('Is playing sound:', correctAudio.played.length > 0);
        } else {
            wrongAudio.play().catch((e) => console.warn("Could not play wrong sound:", e));
            console.log('Is playing sound:', wrongAudio.played.length > 0);
        }

        if (scoreRecorded) {
          message.info("Đáp án đã được ghi nhận cho lượt này.");
          return;
        }
        if (!activeAnsweringTeamId) {
            message.error("Chưa chọn đội trả lời!");
            return;
        }
        if (!matchId || !packageId || !currentQuestionKeyForScoring) {
            message.error("Thiếu thông tin (trận đấu, gói, hoặc câu hỏi) để ghi điểm.");
            return;
        }

        if (!correctChoice && !isStealPhase) {
            setIsTimerRunning(false);
            setIsStealPhase(true);
            setSelectedStealTeamId(null);
            message.warning("Đội đầu tiên trả lời sai. Chọn 1 trong 3 đội còn lại để giành quyền trả lời.");
            return;
        }

        setShowAnswer(true); 
        setIsTimerRunning(false); 
        setScoreRecorded(true); 

        let currentTeamName = teamsInMatch.find(t => t.id === activeAnsweringTeamId)?.name || activeAnsweringTeamId;
        if (!teamsInMatch.find(t => t.id === activeAnsweringTeamId)) {
            try {
                const teamDetailsSnapshot = await get(ref(database, `teams/${activeAnsweringTeamId}`));
                if (teamDetailsSnapshot.exists()) {
                    currentTeamName = teamDetailsSnapshot.val().name || activeAnsweringTeamId;
                }
            } catch (e) {
                 console.warn(`[ContestPart3] Could not fetch name for current team ${activeAnsweringTeamId}`, e);
            }
        }

        const points = correctChoice ? (isStealPhase ? 5 : 10) : 0; 
        const questionScorePath = `matches/${matchId}/scores/${roundId}/${packageId}/${currentQuestionKeyForScoring}`;
         
        try {
            if (correctChoice) {
                const scoreDataToSet = {
                    team_id: activeAnsweringTeamId,
                    team_name: currentTeamName,
                    score: points,
                    timestamp: serverTimestamp(), 
                };
                await set(ref(database, questionScorePath), scoreDataToSet);
                message.success(`Đã ghi ${points} điểm cho đội "${currentTeamName}".`);
            } else {
                message.warning(`Đội "${currentTeamName}" trả lời sai. Mảnh ghép sẽ bị khóa.`);
            }
            
            if (onScoreUpdate) {
                onScoreUpdate(activeAnsweringTeamId, currentQuestionKeyForScoring, points);
            }
            if (isJigsawQuestion && jigsawQuestionKey && onJigsawQuestionAnsweredCallback) {
                onJigsawQuestionAnsweredCallback(jigsawQuestionKey, correctChoice, activeAnsweringTeamId);
            }
        } catch (error) {
            console.error("[ContestPart3] Error setting score: ", error);
            message.error("Lỗi ghi điểm: " + error.message);
        }
    };

    const handleLockPiece = async () => {
        if (scoreRecorded) {
            message.info("Đáp án đã được ghi nhận cho lượt này.");
            return;
        }
        if (!isJigsawQuestion || !jigsawQuestionKey || !onJigsawQuestionAnsweredCallback) {
            message.error("Không thể khóa mảnh ghép ở màn hình hiện tại.");
            return;
        }

        setShowAnswer(true);
        setIsTimerRunning(false);
        setScoreRecorded(true);
        setIsStealPhase(false);
        setSelectedStealTeamId(null);

        try {
            await onJigsawQuestionAnsweredCallback(jigsawQuestionKey, false, null);
            message.warning("Đã khóa mảnh ghép.");
        } catch (error) {
            console.error("[ContestPart3] Error locking jigsaw piece: ", error);
            message.error("Lỗi khóa mảnh ghép.");
        }
    };
    
    const toggleAnswer = () => {
        setShowAnswer(prevShowAnswer => {
            const newShowAnswer = !prevShowAnswer;
            if (newShowAnswer && isTimerRunning) { 
                setIsTimerRunning(false); 
            }
            return newShowAnswer;
        });
    };

    const baseHeaderStyle = { 
        width: '100%', backgroundColor: '#d13c30', minHeight: '80px', 
        padding: '10px 30px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
        position: 'relative', zIndex: 20,
    };
    const baseHeaderTitleStyle = { 
        margin: 0, color: 'white', textTransform: 'uppercase', letterSpacing: '1px', 
        fontSize: 'clamp(20px, 3.5vw, 36px)', fontWeight: 'bold',
        textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)', flexGrow: 1, textAlign: 'center',
    };
    const mainQuizContentStyle = { 
        flex: 1, display: 'flex', flexDirection: 'column', 
        position: 'relative', padding: '0px', overflow: 'hidden', 
        maxHeight: 'calc(100vh - 170px)', // Adjusted to account for header height
    };
    const quizContainerStyle = { 
        display: 'flex', padding: '20px', gap: '20px', 
        height: '100%', flexGrow: 1,
    };
    const quizContentAreaStyle = { 
        flex: 1, display: 'flex', flexDirection: 'column', gap: '15px', 
    };
    const topControlsStyle = {
        display: 'flex', justifyContent: 'space-between', alignItems: 'stretch',
        gap: '10px', flexWrap: 'wrap', minHeight: '60px',
    };
    const controlBoxBaseStyle = {
        backgroundColor: 'rgba(255, 255, 255, 0.9)', border: '2px solid #d13c30',
        borderRadius: '10px', padding: '0 15px', fontSize: 'clamp(20px, 2.5vw, 24px)',
        fontWeight: 'bold', color: '#d13c30', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
        textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%',
    };
    const timerStyle = { ...controlBoxBaseStyle, minWidth: '150px', cursor: 'pointer', fontSize: 'clamp(22px, 3vw, 28px)' };
    const teamStyle = { 
        ...controlBoxBaseStyle, 
        flexGrow: 1, 
        // minWidth: '150px', 
        // maxWidth: '800px', 
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    };
    const resultButtonsContainerStyle = { display: 'flex', gap: '10px', height: '100%' };

    const getResultButtonStyle = (type) => {
        let style = {
            ...controlBoxBaseStyle, cursor: 'pointer',
            fontSize: 'clamp(16px, 2vw, 20px)', 
            transition: 'background-color 0.2s ease, color 0.2s ease',
        };
        const isCorrectAction = type === 'correct';
        const isIncorrectAction = type === 'incorrect';
        const isLockAction = type === 'lock';

        if (isCorrectAction) {
            style.minWidth = '100px';
            style.borderColor = '#28a745';
            style.color = '#28a745';
            if (scoreRecorded && question?.userChoiceWasCorrect) { // Assuming you might store this if needed
                style.backgroundColor = '#28a745'; style.color = 'white';
            } else if (hoveredButton === 'correct' && !scoreRecorded) {
                style.backgroundColor = 'rgba(40, 167, 69, 0.15)';
            }
        } else if (isIncorrectAction) {
            style.minWidth = '100px';
            style.borderColor = '#d13c30';
            style.color = '#d13c30';
             if (scoreRecorded && !question?.userChoiceWasCorrect) { // Assuming you might store this
                style.backgroundColor = '#d13c30'; style.color = 'white';
            } else if (hoveredButton === 'incorrect' && !scoreRecorded) {
                style.backgroundColor = 'rgba(209, 60, 48, 0.1)';
            }
        } else if (isLockAction) {
            style.minWidth = '120px';
            style.borderColor = '#fa8c16';
            style.color = '#fa8c16';
            if (hoveredButton === 'lock' && !scoreRecorded) {
                style.backgroundColor = 'rgba(250, 140, 22, 0.12)';
            }
        } else { // Show/Hide Answer button
            style.borderColor = '#6c757d';
            style.color = '#333'; // Dark text for better readability on light button
            style.minWidth = '150px';
            style.backgroundColor = 'rgba(255, 255, 255, 0.9)'; // Ensure it's light
            if (hoveredButton === 'toggleAnswer') style.backgroundColor = 'rgba(108, 117, 125, 0.2)';
        }
        if (scoreRecorded && (isCorrectAction || isIncorrectAction || isLockAction)) {
             style.cursor = 'not-allowed';
             style.opacity = 0.7;
        }
        return style;
    };
    
    const questionDisplayBoxStyle = { 
        flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '2px solid #d13c30',
        borderRadius: '10px', padding: '20px', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
        overflowY: 'auto', color: '#333', display: 'flex', flexDirection: 'column', 
    };
    const questionTitleStyle = { 
        color: '#d13c30', fontSize: 'clamp(18px, 2.2vw, 24px)', fontWeight: 'bold',
        textAlign: 'left', flexShrink: 0, marginBottom: '15px',
    };
    const questionTextWrapperStyle = {
        flexGrow: 1, width: '100%', display: 'flex', justifyContent: 'center', 
        alignItems: 'center', padding: '10px 0',
    };
    // const questionTextStyle = { 
    //     fontSize: 'clamp(22px, 3.2vw, 30px)', lineHeight: 1.6, textAlign: 'center', // Changed to center
    //     maxWidth: '95%', color: '#333', whiteSpace: 'pre-line'
    // };

    const questionTextStyle = { 
        // fontSize: 'clamp(26px, 3.8vw, 36px)', // Updated font size to match answerTextStyle
        // lineHeight: 1.5, // You might want to adjust lineHeight if the new size causes overlap or too much/little space
        // textAlign: 'center', // Centers the text lines within the paragraph
        // maxWidth: '90%',     // Prevents very long lines
        // color: '#333',
        // fontWeight: 'bold', // Normal weight for question text
        
        fontSize: 'clamp(26px, 3.8vw, 36px)', // Adjusted for balance
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
        padding: '10px', // Add some padding around the text
        width: '100%', // Ensure it can center within the flex container
        lineHeight: '1.5', // Added for better readability of potentially longer text
    };
    const mediaWrapperStyle = {
        flexGrow: 1, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center',
        maxHeight: '50vh', minHeight: '200px', // Adjusted
        // marginTop: '15px', 
    };
    const prominentMediaStyle = {
        maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
        borderRadius: '8px', display: 'block', backgroundColor: 'rgba(0,0,0,0.05)',
    };
    const iframeMediaStyle = {
        width: 'clamp(300px, 80%, 700px)', aspectRatio: '16/9', maxHeight: '100%', // Clamped width
        border: 'none', borderRadius: '8px', display: 'block',
    };
    const answerRevealBoxStyle = { ...questionDisplayBoxStyle };
    const answerTextStyle = {
        flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center',
        fontSize: 'clamp(24px, 3.5vw, 40px)', lineHeight: 1.5, color: '#d13c30',
        fontWeight: 'bold', textAlign: 'center', width: '100%',
        textShadow: '1px 1px 3px rgba(0,0,0,0.2)', marginTop: '10px', whiteSpace: 'pre-line'
    };
    const localControlButtonBaseStyle = { 
        width: '50px', height: '50px', fontSize: '18px', fontWeight: 'bold',
        border: '2px solid white', backgroundColor: 'rgba(0, 0, 0, 0.4)', color: 'white',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        boxShadow: '0px 0px 10px rgba(255, 255, 255, 0.3)', borderRadius: '8px',
    };

    const stealTeams = useMemo(
        () => teamsInMatch.filter(t => t.id !== currentAnsweringTeamId),
        [teamsInMatch, currentAnsweringTeamId]
    );
    const displayedTeamName = isStealPhase
        ? (teamsInMatch.find(t => t.id === selectedStealTeamId)?.name || "Chọn đội cướp quyền")
        : (teamsInMatch.find(t => t.id === currentAnsweringTeamId)?.name || "Chưa chọn đội")
    const actionButtonsDisabled = scoreRecorded || (isStealPhase && !selectedStealTeamId);

    if (!question) {
        return (
            <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: `url(${commonPartBackground})`, backgroundSize: 'cover' }}>
                <div style={baseHeaderStyle}>
                    <Title level={3} style={baseHeaderTitleStyle}>{partTitle}</Title>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.5rem', flexDirection: 'column', gap: '10px' }}>
                    <Spin tip="Đang tải câu hỏi..." size="large" />
                    <Paragraph style={{color: 'white', marginTop: 10}}>Câu hỏi không tồn tại hoặc chưa được chọn.</Paragraph>
                </div>
                 <div style={{ position: 'absolute', bottom: '30px', left: '30px', zIndex: 1000 }}>
                    <Button icon={<ArrowLeftOutlined />} style={localControlButtonBaseStyle} onClick={onBackToPackageSelection} title="Về màn hình trước" />
                </div>
            </div>
        );
    }
    
    const formattedTime = `${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(2, '0')}`;
    const youtubeEmbedUrl = question?.media?.type === 'youtube' && question?.media?.url ? getYoutubeEmbedUrl(question.media.url) : null;
    const shouldShowMedia = question?.media?.url && question?.media?.type && question.media.type !== 'none';

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', color: 'white', position: 'relative', background: `url(${commonPartBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <div style={baseHeaderStyle}>
                 <Title level={2} style={baseHeaderTitleStyle}>{partTitle}</Title>
            </div>

            <div style={mainQuizContentStyle}>
                <div style={quizContainerStyle}>
                    <div style={quizContentAreaStyle}> {/* This is the main content column */}
                        <div style={topControlsStyle}>
                            <div style={timerStyle} onClick={handleTimerClick} title="Nhấn để Dừng/Chạy, 3 lần nhanh để Reset">
                                {formattedTime} {isTimerRunning ? <PauseCircleOutlined style={{marginLeft: 5}}/> : <PlayCircleOutlined style={{marginLeft: 5}}/>}
                            </div>
                            <div style={teamStyle}>
                                <Text style={{fontWeight:'bold'}}></Text> {displayedTeamName}
                            </div>
                            <div style={resultButtonsContainerStyle}>
                                <Button 
                                  style={getResultButtonStyle('correct')} 
                                  onClick={() => handleScore(true)} 
                                  icon={<CheckCircleOutlined />} 
                                  disabled={actionButtonsDisabled}
                                  onMouseEnter={() => setHoveredButton('correct')}
                                  onMouseLeave={() => setHoveredButton(null)}
                                > ĐÚNG </Button>
                                <Button 
                                  style={getResultButtonStyle('incorrect')} 
                                  onClick={() => handleScore(false)} 
                                  icon={<CloseCircleOutlined />} 
                                  disabled={actionButtonsDisabled}
                                  onMouseEnter={() => setHoveredButton('incorrect')}
                                  onMouseLeave={() => setHoveredButton(null)}
                                > SAI </Button>
                                <Button
                                  style={getResultButtonStyle('lock')}
                                  onClick={handleLockPiece}
                                  icon={<LockOutlined />}
                                  disabled={scoreRecorded}
                                  onMouseEnter={() => setHoveredButton('lock')}
                                  onMouseLeave={() => setHoveredButton(null)}
                                > KHÔNG TRẢ LỜI </Button>
                                {/* <Button 
                                  style={getResultButtonStyle('toggleAnswer')} 
                                  onClick={toggleAnswer} 
                                  icon={<SoundOutlined />}
                                  onMouseEnter={() => setHoveredButton('toggleAnswer')}
                                  onMouseLeave={() => setHoveredButton(null)}
                                >{showAnswer ? "Ẩn Đáp Án" : "Hiện Đáp Án"}</Button> */}
                            </div>
                        </div>

                        {!showAnswer ? (
                            <div style={questionDisplayBoxStyle}> 
                                <Typography.Title level={4} style={questionTitleStyle}>
                                    GÓI {selectedPackageName} - Câu hỏi {parseInt(jigsawQuestionKey.split("_")[1])}
                                </Typography.Title>
                                <div style={questionTextWrapperStyle}> 
                                    <Typography.Paragraph style={questionTextStyle}>
                                        {question.question}
                                    </Typography.Paragraph>
                                </div>
                                {shouldShowMedia && (
                                    <div style={mediaWrapperStyle}> 
                                        {question.media?.type === 'image' && <img src={question.media.url} alt="media" style={prominentMediaStyle} />}
                                        {question.media?.type === 'audio' && <audio controls src={question.media.url} style={{ width: '100%', marginTop: '10px' }} />}
                                        {question.media?.type === 'video' && 
                                            <video controls style={prominentMediaStyle}>
                                                <source src={question.media.url} type="video/mp4" />
                                                Trình duyệt của bạn không hỗ trợ thẻ video.
                                            </video>
                                        }
                                        {question.media?.type === 'youtube' && youtubeEmbedUrl && (
                                            <iframe style={iframeMediaStyle} src={youtubeEmbedUrl} title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen></iframe>
                                        )}
                                        {question.media?.type === 'youtube' && !youtubeEmbedUrl && question.media?.url && (
                                            <Text type="secondary" style={{display: 'block', textAlign: 'center', marginTop: '10px', color: '#ffccc7'}}>
                                                Link YouTube không hợp lệ hoặc không thể hiển thị.
                                            </Text>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={answerRevealBoxStyle}>
                                <Typography.Title level={4} style={{...questionTitleStyle, color: '#d13c30'}}>
                                    GÓI {selectedPackageName} - Câu hỏi {parseInt(jigsawQuestionKey.split("_")[1])}: Đáp Án
                                </Typography.Title>
                                <Typography.Paragraph style={answerTextStyle}>
                                    {(question.answer !== undefined && question.answer !== null && String(question.answer).trim() !== '') ? question.answer : '(Không có đáp án được cung cấp)'}
                                </Typography.Paragraph>
                            </div>
                        )}
                    </div>
                    {/* No right column for number buttons in Part 3 */}
                </div>
            </div>

            {isStealPhase && !scoreRecorded && teamsInMatch && teamsInMatch.length > 0 && (
                <div style={{
                    position: 'absolute',
                    bottom: '30px',
                    right: '30px',
                    zIndex: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                }}>
                    {selectedStealTeamId && teamsInMatch.find(t => t.id === selectedStealTeamId) ? (
                    <div style={{
                        height: '50px',
                        padding: '0 15px',
                        backgroundColor: 'rgba(0, 0, 0, 0.35)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        boxShadow: '0px 0px 8px rgba(0, 0, 0, 0.2)',
                        marginRight: '5px',
                    }}>
                        {teamsInMatch.find(t => t.id === selectedStealTeamId)?.name}
                    </div>
                    ) : (
                    <div style={{
                        height: '50px',
                        padding: '0 15px',
                        backgroundColor: 'rgba(0, 0, 0, 0.35)',
                        color: '#ccc',
                        fontStyle: 'italic',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        boxShadow: '0px 0px 8px rgba(0, 0, 0, 0.2)',
                        marginRight: '5px',
                    }}>
                        Chọn đội cướp quyền
                    </div>
                    )}
                    {stealTeams.slice(0, 3).map((team, index) => {
                    const isActive = selectedStealTeamId === team.id;
                    return (
                        <Button
                        key={team.id}
                        onClick={() => {
                            setSelectedStealTeamId(team.id);
                            setTimeLeft(10);
                            setIsTimerRunning(true);
                        }}
                        style={{
                            width: '50px',
                            height: '50px',
                            fontSize: '16px',
                            borderRadius: '8px',
                            border: '2px solid white',
                            backgroundColor: isActive ? '#FFC107' : 'rgba(0,0,0,0.3)',
                            color: isActive ? 'black' : 'white',
                            fontWeight: 'bold',
                            padding: 0,
                            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                            transition: 'all 0.2s ease',
                        }}
                        onMouseOver={(e) => {
                            if (!isActive) {
                            e.currentTarget.style.transform = 'scale(1.1)';
                            e.currentTarget.style.boxShadow = '0 6px 10px rgba(0,0,0,0.25)';
                            }
                        }}
                        onMouseOut={(e) => {
                            if (!isActive) {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                            }
                        }}
                        >
                        {teamsInMatch.findIndex((item) => item.id === team.id) + 1}
                        </Button>
                    );
                    })}
                </div>
            )}


            {!isStealPhase && !scoreRecorded && teamsInMatch && teamsInMatch.length > 0 && (
                <div style={{
                    position: 'absolute',
                    bottom: '30px',
                    right: '30px',
                    zIndex: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                }}>
                    <div style={{
                        height: '50px',
                        padding: '0 15px',
                        backgroundColor: 'rgba(0, 0, 0, 0.35)',
                        color: currentAnsweringTeamId ? 'white' : '#ccc',
                        fontStyle: currentAnsweringTeamId ? 'normal' : 'italic',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        boxShadow: '0px 0px 8px rgba(0, 0, 0, 0.2)',
                        marginRight: '5px',
                        minWidth: '220px',
                    }}>
                        {displayedTeamName}
                    </div>
                    {teamsInMatch.map((team, index) => {
                        const isActive = currentAnsweringTeamId === team.id;
                        return (
                            <Button
                                key={team.id}
                                onClick={() => onSelectTeamForPackage(team.id)}
                                style={{
                                    width: '50px',
                                    height: '50px',
                                    fontSize: '16px',
                                    borderRadius: '8px',
                                    border: '2px solid white',
                                    backgroundColor: isActive ? '#FFC107' : 'rgba(0,0,0,0.3)',
                                    color: isActive ? 'black' : 'white',
                                    fontWeight: 'bold',
                                    padding: 0,
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                {index + 1}
                            </Button>
                        );
                    })}
                </div>
            )}

            <div style={{ position: 'absolute', bottom: '30px', left: '30px', zIndex: 1000 }}>
                <Button
                    icon={<ArrowLeftOutlined />}
                    style={localControlButtonBaseStyle}
                    onClick={onBackToPackageSelection} 
                    title="Về màn hình trước"
                />
            </div>
        </div>
    );
};

// Helper function to convert number to Roman numeral (used by copied PackageSelectionScreen)
const toRoman = (num) => {
  if (num === 1) return 'I';
  if (num === 2) return 'II';
  if (num === 3) return 'III';
  if (num === 4) return 'IV';
  return num.toString(); 
};

// --- Copied PackageSelectionScreen from ContestPart1.jsx ---
// Màn hình CHỌN GÓI - TÁI CẤU TRÚC HOÀN TOÀN
const PackageSelectionScreen = ({
  partTitle,
  packages,
  teams,
  onSelectPackage,
  onSelectBonusJigsaw,
  bonusJigsawPackage,
  onBackToIntroScreen,
  selectedTeamIdForPackage,
  onSelectTeamForPackage,
  modal,
  controlButtonBaseStyle,
  matchData
}) => {
  const packageLayout = [
    { dataKey: 'package_1', label: 'I', color: '#d13c30' },
    { dataKey: 'package_2', label: 'II', color: '#4aafce' },
    { dataKey: 'package_3', label: 'III', color: '#f7913e' },
    { dataKey: 'package_4', label: 'IV', color: '#5ebfb5' }
  ];

  const availablePackages = packages && Object.keys(packages).length > 0;
  const usedTeamIds = new Set(
    packageLayout
      .map((pkgInfo) => matchData?.jigsaw_states?.round_3?.[pkgInfo.dataKey]?.teamId)
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
    textAlign: 'center',
  };

  const mainContentStyle = {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    padding: '24px 24px 88px',
    position: 'relative',
    overflow: 'hidden',
    gap: '18px',
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
    gridTemplateColumns: 'repeat(2, minmax(280px, 420px))',
    gap: '28px',
    width: 'min(980px, 92vw)',
    justifyContent: 'center',
    gridAutoRows: 'minmax(200px, 220px)',
  };

  const categoryBaseStyle = {
    width: '100%',
    minHeight: '220px',
    borderRadius: '30px',
    boxShadow: '0 16px 28px rgba(0,0,0,0.2)',
    transition: 'transform 0.25s ease, box-shadow 0.25s ease, opacity 0.25s ease',
    overflow: 'hidden',
    cursor: 'pointer',
    border: 'none',
    padding: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    background: 'transparent',
  };

  const categoryTextStyle = {
    margin: 0,
    color: 'white',
    fontSize: 'clamp(2.8rem, 4.2vw, 4.6rem)',
    fontWeight: 'bold',
    textShadow: '0 4px 10px rgba(0,0,0,0.3)',
    zIndex: 1,
  };

  const bonusJigsawUsed =
    !!bonusJigsawPackage &&
    (
      !!matchData?.jigsaw_states?.round_3?.[bonusJigsawPackage.dataKey]?.main_hint ||
      Object.keys(matchData?.jigsaw_states?.round_3?.[bonusJigsawPackage.dataKey] || {}).length === 9
    );

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
        background: 
          `url(${commonPartBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div style={headerStyle}>
        <Title level={2} style={headerTitleStyle}>
          {partTitle}
        </Title>
      </div>

      <div style={mainContentStyle}>
        {!availablePackages ? (
          <Text style={{color: '#ffc107', fontSize: '24px', fontStyle: 'italic', backgroundColor: 'rgba(0,0,0,0.7)', padding: '20px', borderRadius: '10px'}}>
            Phần thi này chưa có gói câu hỏi nào.
          </Text>
        ) : (
          <>
            <div style={gridContainerStyle}>
              {packageLayout.map((pkgInfo) => {
                const packageData = packages[pkgInfo.dataKey];
                const isPackageUsed = !!matchData?.jigsaw_states?.round_3?.[pkgInfo.dataKey]?.main_hint || Object.keys(matchData?.jigsaw_states?.round_3?.[pkgInfo.dataKey] || {}).length === 9;

                if (!packageData) {
                  return (
                    <div
                      key={pkgInfo.dataKey}
                      style={{
                        ...categoryBaseStyle,
                        backgroundColor: '#555',
                        border: '2px dashed #777',
                        cursor: 'default',
                      }}
                    >
                      <Text style={{...categoryTextStyle, fontSize: '2rem', color: '#aaa'}}>?</Text>
                    </div>
                  );
                }

                return (
                  <Button
                    key={pkgInfo.dataKey}
                    onClick={() => onSelectPackage(pkgInfo.dataKey)}
                    disabled={isPackageUsed}
                    style={{
                      ...categoryBaseStyle,
                      ...(isPackageUsed && {
                        cursor: 'not-allowed',
                        filter: 'grayscale(0.08)',
                      }),
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
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22)',
                          zIndex: 0,
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
          </>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: '30px',
          left: '30px',
          zIndex: 1001,
        }}
      >
        <Button
          icon={<ArrowLeftOutlined />}
          style={controlButtonBaseStyle}
          onClick={onBackToIntroScreen}
          title="Về Màn Hình Giới Thiệu"
        />
      </div>

      {bonusJigsawPackage && (
        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            right: '30px',
            zIndex: 1001,
          }}
        >
          <Button
            icon={<FileImageOutlined />}
            style={{
              ...controlButtonBaseStyle,
              width: 'auto',
              minWidth: '56px',
              padding: '0 14px',
              gap: '8px',
            }}
            disabled={bonusJigsawUsed}
            onClick={() => onSelectBonusJigsaw?.(bonusJigsawPackage.dataKey)}
            title={bonusJigsawUsed ? 'Mật ảnh vòng phụ đã mở' : 'Mở mật ảnh vòng phụ'}
          >
            Phụ
          </Button>
        </div>
      )}
    </div>
  );
};
// --- End of Copied PackageSelectionScreen ---


const RulesModalPart3 = ({ visible, onClose, rulesContent, onConfirmStart }) => (
    <Modal
        title="Thể Lệ Phần Thi 3: Tự hào tiến bước"
        open={visible}
        onCancel={onClose}
        width="82vw"
        centered
        destroyOnHidden
        styles={{ body: { padding: '12px 16px' } }}
        getContainer={false}
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


// --- Jigsaw Screen for Part 3 ---
const JigsawScreen = ({
    partTitle,
    packageName,
    packageData, // Contains questions (question_1 to question_9) and hint_image_url, hint_answer
    onBackToPackageSelection,
    onSelectJigsawPiece, // Callback when a piece is clicked -> (questionData, questionKey)
    matchId,
    roundId,
    packageId,
    controlButtonBaseStyle, // Prop for standardized control button style
    teamsInMatch,
    selectedTeamIdForPackage,
    onSelectTeamForPackage,
}) => {
    const [pieceStates, setPieceStates] = useState({}); // e.g., { question_1: 'unanswered', question_2: 'opened', ... }
    const [loadingPieceStates, setLoadingPieceStates] = useState(true);
    const [showMainHintAnswer, setShowMainHintAnswer] = useState(false);
    const { modal } = App.useApp(); // For Modal.confirm etc. if needed inside JigsawScreen

    const JIGSAW_STATE_PATH = `matches/${matchId}/jigsaw_states/${roundId}/${packageId}`;

    useEffect(() => {
        // Listener for piece states from Firebase
        const statesRef = ref(database, JIGSAW_STATE_PATH);
        setLoadingPieceStates(true);
        const listener = onValue(statesRef, (snapshot) => {
            const states = snapshot.val() || {};
            setPieceStates(states);
            setLoadingPieceStates(false);
            console.log("[JigsawScreen] Piece states loaded/updated: ", states);
        }, (error) => {
            console.error("[JigsawScreen] Error loading piece states: ", error);
            message.error("Lỗi tải trạng thái mảnh ghép.");
            setLoadingPieceStates(false);
        });

        return () => off(statesRef, 'value', listener);
    }, [JIGSAW_STATE_PATH]);


    const questions = useMemo(() => {
        const q = [];
        if (packageData) {
            for (let i = 1; i <= 9; i++) {
                const qKey = `question_${i}`;
                if (packageData[qKey]) {
                    q.push({ key: qKey, number: i, data: packageData[qKey] });
                } else {
                    q.push({ key: qKey, number: i, data: null }); // Placeholder for missing question
                }
            }
        }
        return q;
    }, [packageData]);

    const hintImageUrl = packageData?.hint_image_url;
    const hintAnswerText = packageData?.hint_answer;
    const selectedTeam = teamsInMatch?.find((team) => team.id === selectedTeamIdForPackage) || null;
    const mainHintState = pieceStates?.main_hint || null;

    const handlePieceClick = (questionKey, questionData) => {
        if (!questionData) {
            message.error("Câu hỏi cho mảnh ghép này không tồn tại!");
            return;
        }
        onSelectJigsawPiece(questionData, questionKey);
    };
    
    const headerStyle = {
        width: '100%',
        backgroundColor: '#d13c30',
        minHeight: '80px',
        padding: '10px 30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        position: 'relative',
        zIndex: 20,
    };
    const headerTitleStyle = {
        margin: 0,
        color: 'white',
        textTransform: 'uppercase',
        fontSize: 'clamp(20px, 3.5vw, 36px)',
        fontWeight: 'bold',
        letterSpacing: '1px',
        textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)',
        textAlign: 'center',
        flexGrow: 1,
    };
    
    const mainContentStyle = {
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '20px 20px 110px',
        position: 'relative', // For hint answer button
    };

    const jigsawContainerStyle = {
        width: 'clamp(980px, 68vh, 1040px)', 
        aspectRatio: '16 / 9', // Changed from '1 / 1' to '16 / 9'
        backgroundImage: `url(${hintImageUrl || commonPartBackground})`, 
        backgroundSize: 'cover', 
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat', 
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(3, 1fr)',
        gap: '2px', 
        border: '5px solid #8B4513', 
        borderRadius: '10px',
        boxShadow: '0 10px 20px rgba(0,0,0,0.3)',
        position: 'relative', 
    };

    const pieceStyle = (qKey) => {
        const status = pieceStates[qKey]?.status || 'unanswered';
        let style = {
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'clamp(2rem, 8vh, 4rem)', fontWeight: 'bold',
            color: 'white', // Default color for unanswered numbers
            backgroundColor: 'rgb(100, 65, 35)',
            border: '2px solid rgba(255,255,255,0.5)',
            borderRadius: '5px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            textShadow: '1px 1px 3px rgba(0,0,0,0.5)',
        };
        if (status === 'opened') {
            style.backgroundColor = 'transparent';
            style.border = '2px dashed rgba(255,255,255,0.3)';
            style.color = 'transparent'; // Hide number by making text transparent
            style.backgroundImage = 'none'; 
            style.boxShadow = 'none';
        } else if (status === 'locked') {
            style.backgroundColor = 'rgb(50, 50, 50)'; 
            style.color = 'transparent'; // Hide number by making text transparent
        }
        return style;
    };

    // Calculate piece statistics for the modal
    const { openedCount, lockedCount, unansweredCount } = useMemo(() => {
        let oCount = 0;
        let lCount = 0;
        const totalPieces = questions.length; // questions is derived from packageData

        questions.forEach(q => {
            const status = pieceStates[q.key]?.status;
            if (status === 'opened') {
                oCount++;
            } else if (status === 'locked') {
                lCount++;
            }
        });
        
        const uCount = totalPieces - oCount - lCount;
        return { openedCount: oCount, lockedCount: lCount, unansweredCount: uCount };
    }, [pieceStates, questions]);

    if (loadingPieceStates) {
        return (
            <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: `url(${commonPartBackground})`, backgroundSize: 'cover' }}>
                <div style={headerStyle}><Title level={3} style={headerTitleStyle}>{partTitle} - Gói {packageName}</Title></div>
                <div style={{flex:1, display:'flex', justifyContent:'center', alignItems:'center'}}><Spin size="large" tip="Đang tải trạng thái mảnh ghép..." /></div>
            </div>
        );
    }
    
    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: `url(${commonPartBackground})`, backgroundSize: 'cover', color: 'white', overflow: 'hidden' }}>
            <div style={headerStyle}>
                <Title level={3} style={headerTitleStyle}>{partTitle} - Gói {packageName}</Title>
            </div>

            <div style={mainContentStyle}>
                <div style={jigsawContainerStyle}>
                    {questions.map((q) => {
                        const status = pieceStates[q.key]?.status || 'unanswered';
                        return (
                            <div
                                key={q.key}
                                style={pieceStyle(q.key)}
                                onClick={() => handlePieceClick(q.key, q.data)}
                                title={selectedTeamIdForPackage ? `Mở / Xem lại câu hỏi mảnh ${q.number}` : 'Chọn đội trước khi mở mảnh ghép'}
                            >
                                {status === 'unanswered' && q.number} {/* Display number only if unanswered */}
                            </div>
                        );
                    })}
                </div>
            </div>
            
            {/* Back Button at Bottom Left */}
            <div
              style={{
                position: 'absolute',
                bottom: '30px',
                left: '30px',
                zIndex: 1001, 
              }}
            >
              <Button
                icon={<ArrowLeftOutlined />}
                style={controlButtonBaseStyle} // Use the passed-in style from ContestPart3
                onClick={onBackToPackageSelection}
                title="Về Chọn Gói"
              />
            </div>

            {/* Hint Answer Button at Bottom Right */}
            {hintAnswerText && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '30px',
                  right: '30px',
                  zIndex: 1001,
                }}
              >
                <Button
                  icon={<EyeOutlined />}
                  style={controlButtonBaseStyle} // Use the passed-in style
                  onClick={async () => {
                    setShowMainHintAnswer(true);

                    if (mainHintState?.status === 'opened') {
                      return;
                    }

                    if (!selectedTeamIdForPackage) {
                      message.info("Da mo dap an mat anh. Chua chon doi nen khong cong diem.");
                      return;
                    }

                    if (matchId && packageId) {
                    const hiddenPieceCount = lockedCount + unansweredCount;
                    const awardedScore = (hiddenPieceCount * 10) + 50;
                    const pieceRef = ref(database, `matches/${matchId}/jigsaw_states/round_3/${packageId}/main_hint`);
                    const customScoreRef = ref(database, `matches/${matchId}/scores/${roundId}/custom_scores/${selectedTeamIdForPackage}`);
                    try {
                        await runTransaction(customScoreRef, (currentValue) => Number(currentValue || 0) + awardedScore);
                        await firebaseUpdate(pieceRef, {
                            status: 'opened',
                            revealedAt: Date.now(),
                            teamId: selectedTeamIdForPackage,
                            scoreAwarded: awardedScore,
                            hiddenPieceCount,
                        });
                        console.log(`[Jigsaw] Main hint opened for ${packageId}, awarded ${awardedScore} points to ${selectedTeamIdForPackage}`);
                        message.success(`Đã cộng ${awardedScore} điểm cho đội ${selectedTeam?.name || selectedTeamIdForPackage}.`);
                    } catch (error) {
                        console.error("Lỗi khi cập nhật trạng thái mật ảnh:", error);
                        message.error("Không thể cập nhật điểm hoặc trạng thái mật ảnh.");
                    }
                    }
                }}
                  title="Xem đáp án mật ảnh"
                />
              </div>
            )}

            {hintAnswerText && (
                <Modal
                    title="Đáp án mật ảnh"
                    open={showMainHintAnswer}
                    onCancel={() => setShowMainHintAnswer(false)}
                    footer={[<Button key="close" onClick={() => setShowMainHintAnswer(false)}>Đóng</Button>]}
                    width="50vw" 
                    styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }} 
                    destroyOnHidden
                >
                    <Title level={4} style={{textAlign: 'center'}}>{hintAnswerText}</Title>
                    {hintImageUrl && <img src={hintImageUrl} alt="Mật Ảnh" style={{width: '100%', borderRadius: '8px', marginTop: '10px', marginBottom: '20px'}} />}
                    
                    <Paragraph style={{fontWeight: 'bold'}}>Thống kê mảnh ghép:</Paragraph>
                    <ul style={{ listStyleType: 'disc', paddingLeft: '20px' }}>
                        <li>Số mảnh ghép đã mở: <Text strong color="green">{openedCount}</Text></li>
                        <li>Số mảnh ghép bị khóa: <Text strong color="red">{lockedCount}</Text></li>
                        <li>Số mảnh ghép chưa mở: <Text strong>{unansweredCount}</Text></li>
                    </ul>
                </Modal>
            )}

            {teamsInMatch && teamsInMatch.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '30px',
                    right: hintAnswerText ? '100px' : '30px',
                    zIndex: 1001,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      height: '50px',
                      padding: '0 15px',
                      backgroundColor: 'rgba(0, 0, 0, 0.35)',
                      color: selectedTeam ? 'white' : '#ccc',
                      fontStyle: selectedTeam ? 'normal' : 'italic',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      boxShadow: '0px 0px 8px rgba(0, 0, 0, 0.2)',
                      marginRight: '5px',
                      minWidth: '220px',
                    }}
                  >
                    {selectedTeam ? selectedTeam.name : 'Chọn đội trả lời'}
                  </div>

                  {teamsInMatch.map((team, index) => {
                    const isActive = selectedTeamIdForPackage === team.id;
                    return (
                      <Button
                        key={team.id}
                        onClick={() => onSelectTeamForPackage(team.id)}
                        style={{
                          width: '50px',
                          height: '50px',
                          fontSize: '16px',
                          borderRadius: '8px',
                          border: '2px solid white',
                          backgroundColor: isActive ? '#FFC107' : 'rgba(0,0,0,0.3)',
                          color: isActive ? 'black' : 'white',
                          fontWeight: 'bold',
                          padding: 0,
                          boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {index + 1}
                      </Button>
                    );
                  })}
                </div>
            )}
        </div>
    );
};


function ContestPart3() {
    const { matchId } = useParams();
    const navigate = useNavigate();
    const { modal } = App.useApp(); // Get modal instance from Ant Design App context

    const [currentView, setCurrentView] = useState('intro'); // intro, packageSelection, jigsawScreen, questionDisplay
    const [matchData, setMatchData] = useState(null);
    const [round3Data, setRound3Data] = useState(null);
    const [teamsInMatch, setTeamsInMatch] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorLoading, setErrorLoading] = useState(null);
    
    const [rulesVisible, setRulesVisible] = useState(false);
    const [rulesHtmlContent, setRulesHtmlContent] = useState('');
    const [loadingRules, setLoadingRules] = useState(false);

    const [selectedPackageId, setSelectedPackageId] = useState(null);
    const [selectedPackageName, setSelectedPackageName] = useState('');
    const [selectedPackageData, setSelectedPackageData] = useState(null);
    const [selectedTeamIdForPackage, setSelectedTeamIdForPackage] = useState(null); // Team chosen for current package

    const PART_ID = "part_3";
    const ROUND_ID = "round_3";
    const PART_TITLE = "PHẦN THI TỰ HÀO TIẾN BƯỚC";
    const RULES_FILE = "/rules/rules_contest_3.html";

    // Define packageLayout here to derive package names if needed in handlePackageSelected
    const packageLayoutForNameDerivation = [
        { dataKey: 'package_1', label: 'I' },
        { dataKey: 'package_2', label: 'II' },
        { dataKey: 'package_3', label: 'III' },
        { dataKey: 'package_4', label: 'IV' },
    ];

    // States for Jigsaw to QuestionDisplay transition
    const [selectedJigsawQuestionKey, setSelectedJigsawQuestionKey] = useState(null);
    const [selectedJigsawQuestionData, setSelectedJigsawQuestionData] = useState(null);

    const qualifiedTeamsForPart3 = useMemo(() => {
        if (!matchData || teamsInMatch.length === 0) {
            return [];
        }

        const totals = teamsInMatch.reduce((acc, team) => {
            acc[team.id] = 0;
            return acc;
        }, {});

        const round1Scores = matchData.scores?.round_1 || {};
        Object.values(round1Scores).forEach((packageScores) => {
            if (!packageScores || typeof packageScores !== 'object') return;
            Object.values(packageScores).forEach((scoreEntry) => {
                if (!scoreEntry?.team_id) return;
                totals[scoreEntry.team_id] = (totals[scoreEntry.team_id] || 0) + Number(scoreEntry.score || 0);
            });
        });

        const round2CustomScores = matchData.scores?.round_2?.custom_scores || {};
        Object.entries(round2CustomScores).forEach(([teamId, score]) => {
            totals[teamId] = (totals[teamId] || 0) + Number(score || 0);
        });

        return [...teamsInMatch]
            .sort((a, b) => {
                const totalDiff = (totals[b.id] || 0) - (totals[a.id] || 0);
                if (totalDiff !== 0) return totalDiff;
                return a.name.localeCompare(b.name, 'vi');
            })
            .slice(0, 4);
    }, [matchData, teamsInMatch]);

    const bonusJigsawPackage = useMemo(() => {
        if (!round3Data || typeof round3Data !== 'object') {
            return null;
        }

        const defaultPackageKeys = new Set(['package_1', 'package_2', 'package_3', 'package_4', 'status']);
        const extraPackageEntry = Object.entries(round3Data).find(([key, value]) => {
            if (defaultPackageKeys.has(key) || !value || typeof value !== 'object' || Array.isArray(value)) {
                return false;
            }

            const questionCount = Object.keys(value).filter((itemKey) => itemKey.startsWith('question_')).length;
            return questionCount >= 9 && !!value.hint_image_url;
        });

        if (!extraPackageEntry) {
            return null;
        }

        const [dataKey, data] = extraPackageEntry;
        return {
            dataKey,
            data,
            label: data?.name || 'Mật ảnh phụ',
        };
    }, [round3Data]);

    useEffect(() => {
        if (!matchId) {
            setErrorLoading("ID trận đấu không hợp lệ.");
            setLoading(false);
            return;
        }
        console.log(`[ContestPart3] Mounting. Fetching data for matchId: ${matchId}`);
        setLoading(true);
        setErrorLoading(null);

        const matchRef = ref(database, `matches/${matchId}`);
        const teamsRef = ref(database, 'teams');
        
        let matchDataListener;
        let teamsDataCache = {};
        let latestMatchData = null;

        const syncTeamsInMatch = (matchInfo, allTeamsData) => {
            if (!matchInfo?.team_ids || !Array.isArray(matchInfo.team_ids)) {
                setTeamsInMatch([]);
                return;
            }

            if (!allTeamsData || Object.keys(allTeamsData).length === 0) {
                return;
            }

            const currentTeams = matchInfo.team_ids
                .map(teamId => allTeamsData[teamId] ? { ...allTeamsData[teamId], id: teamId } : null)
                .filter(team => team !== null);

            setTeamsInMatch(currentTeams);
        };

        const teamsListener = onValue(teamsRef, (snapshot) => {
            teamsDataCache = snapshot.val() || {};
            console.log('[ContestPart3] Teams data received:', teamsDataCache);
            syncTeamsInMatch(latestMatchData, teamsDataCache);
        }, (error) => {
            console.error("[ContestPart3] Firebase read all teams failed:", error);
            message.error('Lỗi tải danh sách đội.');
        });

        matchDataListener = onValue(matchRef, (snapshot) => {
            const data = snapshot.val();
            console.log("[ContestPart3] Match data received:", data);
            if (data && typeof data === 'object') {
                setMatchData(data);
                const r3Data = data[ROUND_ID] || {};
                setRound3Data(r3Data);
                console.log("[ContestPart3] Round 3 data set:", r3Data);

                if (data.team_ids && Object.keys(teamsDataCache).length > 0) {
                    const currentTeams = data.team_ids
                        .map(teamId => teamsDataCache[teamId] ? { ...teamsDataCache[teamId], id: teamId } : null)
                        .filter(team => team !== null);
                    setTeamsInMatch(currentTeams);
                    console.log("[ContestPart3] Teams in match updated (from matchDataListener):", currentTeams);
                } else if (!data.team_ids) {
                    setTeamsInMatch([]);
                    console.log("[ContestPart3] No team_ids in match data, teamsInMatch set to empty.");
                }
                 if (Object.keys(r3Data).length === 0) {
                    console.warn(`[ContestPart3] Round 3 data for match ${matchId} is empty or not found.`);
                }
            } else {
                setErrorLoading(`Trận đấu với ID "${matchId}" không tồn tại hoặc không có dữ liệu Phần 3.`);
                console.error(`[ContestPart3] Match data for ${matchId} is null or not an object.`);
                setMatchData(null);
                setRound3Data({});
                setTeamsInMatch([]);
            }
            setLoading(false);
        }, (error) => {
            setErrorLoading("Lỗi tải dữ liệu Phần Thi 3 từ Firebase.");
            console.error("[ContestPart3] Firebase read match failed:", error);
            setMatchData(null);
            setRound3Data({});
            setTeamsInMatch([]);
            setLoading(false);
            message.error('Lỗi tải thông tin trận đấu cho Phần 3.');
        });

        return () => {
            console.log("[ContestPart3] Unmounting. Cleaning up listeners.");
            if (matchRef && matchDataListener) off(matchRef, 'value', matchDataListener);
            if (teamsRef && teamsListener) off(teamsRef, 'value', teamsListener);
        };
    }, [matchId]);


    const fetchRulesContent = async () => {
        setLoadingRules(true);
        try {
            const response = await fetch(`${RULES_FILE}?v=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const htmlText = await response.text();
            setRulesHtmlContent(htmlText);
        } catch (error) {
            console.error("Error fetching rules HTML for Part 3:", error);
            setRulesHtmlContent("<p>Không thể tải được nội dung thể lệ. Vui lòng thử lại sau.</p>");
        }
        setLoadingRules(false);
    };

    const handleBackToLauncher = () => {
        navigate(`/organizer/contest/${matchId}`);
    };
    
    const handleShowRules = () => {
        if (!rulesHtmlContent && !loadingRules) fetchRulesContent();
        setRulesVisible(true);
    };
    const handleCloseRules = () => setRulesVisible(false);

    const handleShowScore = () => {
        navigate(`/organizer/contest/${matchId}/part3/scoreboard`);
    };

    const handleStartPartOrPackageSelection = () => {
        console.log('[ContestPart3] handleStartPartOrPackageSelection called. currentView:', currentView, 'round3Data:', round3Data);
        if (loading) {
            message.warn("Dữ liệu đang tải, vui lòng chờ...");
            return;
        }
        if (!round3Data || Object.keys(round3Data).length === 0 || 
            !round3Data.package_1 || !round3Data.package_2 || !round3Data.package_3 || !round3Data.package_4) { // Check for all 4 expected packages
            modal.warning({
                title: "Chưa có đủ gói câu hỏi",
                content: "Phần thi 3 yêu cầu đủ 4 gói câu hỏi (package_1 đến package_4) được cấu hình.",
                okText: "Đã Hiểu"
            });
            console.log('[ContestPart3] Not enough package data available to start package selection.');
            return;
        }
        setCurrentView('packageSelection');
        setSelectedTeamIdForPackage(null); // Reset selected team
        if (rulesVisible) setRulesVisible(false);
    };
    
    const handlePackageSelected = (packageKey) => {
        const data = round3Data[packageKey];
        const layoutInfo = packageLayoutForNameDerivation.find(p => p.dataKey === packageKey);
        const pkgName = data?.name || layoutInfo?.label || packageKey.replace('package_', 'Gói ');

        console.log(`[ContestPart3] Package ${packageKey} (${pkgName}) selected. Data:`, data);
        
        // Check for questions and hint_image_url for Jigsaw
        const questionKeysForJigsaw = packageKey ? Object.keys(data || {}).filter(k => k.startsWith('question_')) : [];
        if (!data || questionKeysForJigsaw.length < 9 || !data.hint_image_url) {
            modal.error({
                title: "Lỗi Gói Câu Hỏi (Ô Chữ)",
                content: `Gói "${pkgName}" không đủ 9 câu hỏi hoặc thiếu ảnh mật hiệu. Vui lòng kiểm tra dữ liệu.`, 
            });
            return;
        }
        
        setSelectedPackageId(packageKey);
        setSelectedPackageName(pkgName);
        setSelectedPackageData(data); // This data now includes hint_image_url, hint_answer, and questions
        setSelectedTeamIdForPackage(null);
        setCurrentView('jigsawScreen'); // Transition to Jigsaw screen
    };
    
    const handleBonusJigsawSelected = (packageKey) => {
        const data = round3Data?.[packageKey];
        if (!data) {
            message.error("Không tìm thấy dữ liệu mật ảnh vòng phụ.");
            return;
        }

        const questionKeysForJigsaw = Object.keys(data || {}).filter((key) => key.startsWith('question_'));
        if (questionKeysForJigsaw.length < 9 || !data.hint_image_url) {
            modal.error({
                title: "Lỗi mật ảnh vòng phụ",
                content: "Mật ảnh vòng phụ chưa đủ 9 câu hỏi hoặc thiếu ảnh gợi ý.",
            });
            return;
        }

        setSelectedPackageId(packageKey);
        setSelectedPackageName(data?.name || bonusJigsawPackage?.label || 'Mật ảnh phụ');
        setSelectedPackageData(data);
        setSelectedTeamIdForPackage(null);
        setCurrentView('jigsawScreen');
    };

    const handleBackToPackageSelectionFromQuestions = () => {
        // If coming from jigsaw's question, go back to jigsaw. Otherwise, package selection.
        if (currentView === 'questionDisplay' && selectedPackageData?.hint_image_url) { // Check if current package is a jigsaw package
            setCurrentView('jigsawScreen');
            setSelectedTeamIdForPackage(null);
        } else {
            setCurrentView('packageSelection');
        }
        setSelectedJigsawQuestionKey(null);
        setSelectedJigsawQuestionData(null);
    };

    const handleBackToIntroFromPackages = () => {
        setCurrentView('intro');
        setSelectedTeamIdForPackage(null); // Clear selected team when going back to intro
    };
    
    const handleTeamSelectedForPackage = (teamId) => {
        setSelectedTeamIdForPackage(teamId);
        console.log(`[ContestPart3] Team ${teamId} selected for package phase.`);
    };

    const handleJigsawPieceSelected = (questionData, questionKey) => {
        console.log(`[ContestPart3] Jigsaw piece ${questionKey} selected. Question:`, questionData);
        setSelectedJigsawQuestionData(questionData);
        setSelectedJigsawQuestionKey(questionKey); // Store the key of the jigsaw piece/question
        
        // The QuestionDisplayScreen will use selectedJigsawQuestionKey (passed as initialQuestionKey) 
        // to set its internal index via its own useEffect.
        // No need to calculate or set index here.

        setCurrentView('questionDisplay');
    };

    const onJigsawQuestionAnswered = (questionKey, isCorrect, answeredTeamId = selectedTeamIdForPackage) => {
        // This function will be called from QuestionDisplayScreen after an answer.
        // It needs to update Firebase: matches/{matchId}/jigsaw_states/{ROUND_ID}/{packageId}/{questionKey}
        const JIGSAW_STATE_PATH_FOR_PIECE = `matches/${matchId}/jigsaw_states/${ROUND_ID}/${selectedPackageId}/${questionKey}`;
        const newStatus = isCorrect ? 'opened' : 'locked';
        
        return firebaseUpdate(ref(database, JIGSAW_STATE_PATH_FOR_PIECE), {
            status: newStatus,
            teamId: answeredTeamId,
            timestamp: Date.now(),
        }).then(() => {
            console.log(`[ContestPart3] Jigsaw piece ${questionKey} status updated to ${newStatus}`);
            // The JigsawScreen's useEffect will pick up this change and re-render.
            setSelectedTeamIdForPackage(null);
        }).catch(err => {
            console.error("[ContestPart3] Error updating jigsaw piece state:", err);
            message.error("Lỗi cập nhật trạng thái mảnh ghép.");
        });
        // setCurrentView('jigsawScreen'); // Go back to jigsaw screen after answering
    };

    const controlButtonBaseStyle = {
        width: '50px',
        height: '50px',
        fontSize: '18px', // Slightly adjust icon size if needed by increasing font size
        fontWeight: 'bold',
        border: '2px solid white',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        color: 'white', 
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0px 0px 10px rgba(255, 255, 255, 0.3)',
        padding: 0, 
        borderRadius: '8px',
    };
    
    const activeButtonStyle = { // Copied from Part 1 for consistency
        borderColor: '#FFC107', // Example active color, adjust as needed
        color: '#FFC107',
        // Add any other active styles from Part 1 if different
    };
    
    const renderMainContent = () => {
        console.log(`[ContestPart3] renderMainContent evaluating. currentView: ${currentView}`, "round3Data:", round3Data);
        switch (currentView) {
            case 'packageSelection':
                if (!round3Data || Object.keys(round3Data).length === 0 || 
                    !round3Data.package_1 || !round3Data.package_2 || !round3Data.package_3 || !round3Data.package_4 ) {
                     console.error("[ContestPart3] Attempted to render packageSelection but round3Data is incomplete.");
                     // Error/warning is handled by handleStartPartOrPackageSelection, this is a fallback
                     return (
                        <div style={{padding: 20, textAlign: 'center', color: 'white', background: `url(${commonPartBackground})`, backgroundSize: 'cover', height: '100vh', display: 'flex', flexDirection:'column', justifyContent:'center', alignItems:'center'}}>
                            <Title level={2} style={{color: 'white'}}>Thiếu gói câu hỏi</Title>
                            <Paragraph style={{color: 'white'}}>Cần đủ 4 gói (I, II, III, IV) cho phần thi này.</Paragraph>
                            <Button onClick={() => setCurrentView('intro')}>Về màn hình giới thiệu</Button>
                        </div>
                    );
                }
                return <PackageSelectionScreen 
                            partTitle={PART_TITLE}
                            packages={round3Data}  
                            teams={teamsInMatch}   
                            onSelectPackage={handlePackageSelected}
                            onSelectBonusJigsaw={handleBonusJigsawSelected}
                            bonusJigsawPackage={bonusJigsawPackage}
                            onBackToIntroScreen={handleBackToIntroFromPackages} 
                            selectedTeamIdForPackage={selectedTeamIdForPackage} 
                            onSelectTeamForPackage={handleTeamSelectedForPackage} 
                            modal={modal}
                            controlButtonBaseStyle={controlButtonBaseStyle}
                            matchData={matchData} // Pass matchData for potential use in PackageSelectionScreen
                        />;
            case 'jigsawScreen':
                if (!selectedPackageData || !selectedPackageId || !selectedPackageData.hint_image_url) {
                     console.error("[ContestPart3] Attempted to render jigsawScreen but data is missing/incomplete.");
                     return (
                        <div style={{padding: 20, textAlign: 'center', color: 'white', background: `url(${commonPartBackground})`, backgroundSize: 'cover', height: '100vh', display: 'flex', flexDirection:'column', justifyContent:'center', alignItems:'center'}}>
                            <Title level={2} style={{color: 'white'}}>Lỗi Dữ Liệu Mật Ảnh</Title>
                            <Paragraph style={{color: 'white'}}>Không đủ thông tin để hiển thị màn hình mật ảnh.</Paragraph>
                            <Button onClick={() => setCurrentView('packageSelection')}>Về chọn gói</Button>
                        </div>
                    );
                }
                return <JigsawScreen
                            partTitle={PART_TITLE}
                            packageName={selectedPackageName}
                            packageData={selectedPackageData} // This has questions and hint_image_url
                            onBackToPackageSelection={() => setCurrentView('packageSelection')}
                            onSelectJigsawPiece={handleJigsawPieceSelected}
                            matchId={matchId}
                            roundId={ROUND_ID}
                            packageId={selectedPackageId}
                            controlButtonBaseStyle={controlButtonBaseStyle}
                            teamsInMatch={qualifiedTeamsForPart3}
                            selectedTeamIdForPackage={selectedTeamIdForPackage}
                            onSelectTeamForPackage={handleTeamSelectedForPackage}
                        />;
            case 'questionDisplay':
                // Determine if it's a regular package question or a jigsaw piece question
                const questionDataSource = selectedJigsawQuestionData ? { [selectedJigsawQuestionKey]: selectedJigsawQuestionData } : selectedPackageData;
                const questionKeyForDisplay = selectedJigsawQuestionKey; // If from jigsaw, this is the specific key
                const packageNameToDisplay = selectedJigsawQuestionKey ? `${selectedPackageName}` : selectedPackageName;

                if (!questionDataSource || (!questionKeyForDisplay && Object.keys(questionDataSource).filter(k => k.startsWith('question_')).length === 0) || !selectedPackageId) {
                     console.error("[ContestPart3] Invalid questionDataSource or no questions in package:", questionDataSource);
                     return (
                        <div style={{padding: 20, textAlign: 'center', color: 'white', background: `url(${commonPartBackground})`, backgroundSize: 'cover', height: '100vh', display: 'flex', flexDirection:'column', justifyContent:'center', alignItems:'center'}}>
                            <Title level={2} style={{color: 'white'}}>Lỗi Tải Câu Hỏi</Title>
                            <Paragraph style={{color: 'white'}}>Không thể tải dữ liệu câu hỏi cho gói đã chọn.</Paragraph>
                            <Button onClick={handleBackToPackageSelectionFromQuestions}>Về chọn gói/mật ảnh</Button>
                        </div>
                    );
                }
                return <QuestionDisplayScreen 
                            partTitle={PART_TITLE}
                            selectedPackageData={questionDataSource} // Pass the correct set of questions
                            selectedPackageName={packageNameToDisplay}
                            onBackToPackageSelection={handleBackToPackageSelectionFromQuestions}
                            matchId={matchId}
                            roundId={ROUND_ID} 
                            packageId={selectedPackageId}
                            teamsInMatch={qualifiedTeamsForPart3}
                            currentAnsweringTeamId={selectedTeamIdForPackage}
                            // NEW: Identify if it's a jigsaw question to trigger state update
                            isJigsawQuestion={!!selectedJigsawQuestionKey}
                            jigsawQuestionKey={selectedJigsawQuestionKey}
                            initialQuestionKey={selectedJigsawQuestionKey}
                            onJigsawQuestionAnsweredCallback={onJigsawQuestionAnswered} // Callback to update jigsaw state
                            selectedTeamIdForPackage={selectedTeamIdForPackage}
                            onSelectTeamForPackage={handleTeamSelectedForPackage}
                        />;
            case 'intro':
            default:
                return ( // Intro screen content
                    <>
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
                                zIndex: 10,
                                pointerEvents: 'none',
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
                        <div style={{
                            width: '100%', 
                            flexGrow: 1, 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            paddingBottom: '100px', 
                            pointerEvents: 'none',
                            zIndex: 10,
                        }}>
                            <Title level={1} style={{
                                color: '#FFF7D6', textAlign: 'center', textShadow: '0 0 18px rgba(10, 40, 120, 0.45), 3px 3px 12px rgba(0, 0, 0, 0.35)', fontWeight: 'bold',
                                fontSize: 'clamp(3rem, 6vw, 6rem)', margin: 0, padding: '0 20px', lineHeight: '1.3',
                            }}>
                                PHẦN THI <br /> "{PART_TITLE.split("PHẦN THI ")[1]}"
                            </Title>
                        </div>

                        {/* Control buttons container */}
                        <div 
                            style={{
                                position: 'absolute', bottom: '30px', right: '30px',
                                display: 'flex', flexDirection: 'row', gap: '10px', zIndex: 1001,
                            }}
                        >
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
                                icon={<PlayCircleOutlined />}
                                style={{
                                    ...controlButtonBaseStyle, 
                                    ...((!loading && round3Data && 
                                        round3Data.package_1 && round3Data.package_2 && 
                                        round3Data.package_3 && round3Data.package_4) 
                                        ? activeButtonStyle 
                                        : {})
                                }} 
                                onClick={handleStartPartOrPackageSelection}
                                title={`Bắt Đầu ${PART_TITLE}`}
                                disabled={loading || !round3Data || 
                                    !round3Data.package_1 || !round3Data.package_2 || 
                                    !round3Data.package_3 || !round3Data.package_4 
                                }
                            />
                        </div>
                        {/* Back to Launcher Button */}
                        <div
                            style={{
                                position: 'absolute',
                                bottom: '30px',
                                left: '30px',
                                zIndex: 1001,
                            }}
                        >
                            <Button
                                icon={<ArrowLeftOutlined />}
                                style={controlButtonBaseStyle}
                                onClick={handleBackToLauncher}
                                title="Về Màn Hình Chính"
                            />
                        </div>
                    </>
                );
        }
    };
    
    if (loading && currentView === 'intro') { // Show main loading spinner only on initial intro load
        return (
            <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundImage: `url(${commonPartBackground})`, backgroundSize: 'cover' }}>
                <Spin size="large" tip={`Đang tải dữ liệu ${PART_TITLE}...`} />
            </div>
        );
    }

    if (errorLoading) {
        return (
            <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundImage: `url(${commonPartBackground})`, backgroundSize: 'cover', padding: 20, textAlign: 'center' }}>
                <Title level={3} style={{color: 'white'}}>Đã xảy ra lỗi</Title>
                <Text style={{color: 'white', fontSize: '18px'}}>{errorLoading}</Text>
                <Button onClick={() => navigate('/organizer')} style={{marginTop: 20}}>Về trang chọn trận</Button>
            </div>
        );
    }

    return (
        <div 
            style={{
                width: '100vw',
                height: '100vh',
                backgroundImage: `url(${commonPartBackground})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative', // Needed for absolute positioning of controls
                overflow: 'hidden', // Prevent main scrollbars if content overflows due to fixed heights
            }}
        >
            {renderMainContent()}
            <RulesModalPart3
                visible={rulesVisible}
                onClose={handleCloseRules}
                rulesContent={loadingRules ? "<p>Đang tải thể lệ...</p>" : rulesHtmlContent}
                onConfirmStart={handleStartPartOrPackageSelection} // Changed from onConfirmStart
            />
        </div>
    );
}

export default ContestPart3; 




