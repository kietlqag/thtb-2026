// // src/styles/baseStyles.js

// // Color Palette
// export const primaryColor = '#0A3D62'; // Dark Blue (Theme's primary color)
// export const secondaryColor = '#1E88E5'; // Lighter Blue
// export const accentColor = '#FFC107'; // Amber/Gold (for highlights, active states)
// export const accentFontColor = '#D83022'; // Reddish color for titles in boxes (from Part 1)
// export const textColorLight = '#FFFFFF';
// export const textColorDark = '#333333';
// export const backgroundColorLight = 'rgba(255, 255, 255, 0.9)'; // Common for content boxes
// export const backgroundColorDark = 'rgba(0, 0, 0, 0.4)';   // Common for button backgrounds
// export const borderColorStandard = '#CCCCCC';
// export const borderColorAccent = accentColor; // Or primaryColor, depending on context
// export const primaryHighlightColor = '#FFD700'; // Gold, used for activeButtonBase borders in Contest.jsx
// export const primaryLightRed = '#D83022'; // Red from part titles, headers, content box borders
// export const accentYellowHighlight = '#FFC107'; // Yellow from part intros "C" button active state

// // Base Styles Objects
// export const pageContainerStyle = {
//   width: '100vw',
//   height: '100vh',
//   display: 'flex',
//   flexDirection: 'column',
//   position: 'relative',
//   overflow: 'hidden',
//   backgroundSize: 'cover', // Applied generally, can be overridden by specific page backgrounds
//   backgroundPosition: 'center', // Applied generally
// };

// export const mainHeaderStyle = {
//   width: '100%',
//   backgroundColor: primaryLightRed, 
//   minHeight: '60px',
//   padding: '10px 20px',
//   display: 'flex',
//   alignItems: 'center',
//   justifyContent: 'center',
//   boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
//   position: 'relative', 
//   zIndex: 20,
//   color: textColorLight,
// };

// export const headerTitleStyle = {
//   margin: 0,
//   color: textColorLight,
//   textTransform: 'uppercase',
//   letterSpacing: '1px',
//   fontSize: 'clamp(20px, 3.5vw, 30px)',
//   fontWeight: 'bold',
//   textAlign: 'center',
//   textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)',
// };

// export const controlButtonBase = {
//   width: '50px',
//   height: '50px',
//   fontSize: '18px',
//   fontWeight: 'bold',
//   border: `2px solid ${textColorLight}`,
//   backgroundColor: backgroundColorDark,
//   color: textColorLight,
//   display: 'flex',
//   justifyContent: 'center',
//   alignItems: 'center',
//   boxShadow: '0px 0px 10px rgba(255, 255, 255, 0.3)',
//   borderRadius: '8px',
//   padding: 0,
//   cursor: 'pointer',
//   transition: 'all 0.2s ease',
// };

// export const activeButtonBase = { // Used for active/selected state of controlButtonBase
//   ...controlButtonBase,
//   borderColor: primaryHighlightColor, // Gold border from Contest.jsx active state
//   color: primaryHighlightColor,       // Gold icon/text from Contest.jsx active state
//   backgroundColor: 'rgba(50, 50, 0, 0.5)', // Darker gold background from Contest.jsx active state
// };

// export const textControlButton = {
//   ...controlButtonBase, 
//   width: 'auto', 
//   minWidth: '120px', 
//   padding: '0 15px', 
//   fontSize: '16px', 
//   height: '45px', 
// };

// export const textControlButtonDisabled = {
//   ...textControlButton, 
//   backgroundColor: 'rgba(100, 100, 100, 0.4)', 
//   borderColor: 'grey', 
//   color: 'lightgrey', 
//   cursor: 'not-allowed',
//   boxShadow: 'none', 
// };

// export const contentBoxStyle = { 
//   backgroundColor: backgroundColorLight,
//   border: `2px solid ${primaryLightRed}`, 
//   borderRadius: '10px',
//   padding: '15px', 
//   boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
//   color: textColorDark, 
//   overflowY: 'auto', 
//   display: 'flex', 
//   flexDirection: 'column', 
// };

// // Specific styles from PartScoreboard (can be generalized or kept specific)
// export const teamNameCellStyleScoreboard = {
//     display: 'flex',
//     justifyContent: 'center',
//     alignItems: 'center',
//     border: `3px solid ${primaryLightRed}`, 
//     borderRadius: '12px',
//     margin: '10px 5px 5px 5px', 
//     padding: '10px',
//     minHeight: '50px', 
//     fontWeight: 'bold',
//     fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)', 
//     backgroundColor: 'white', 
//     color: primaryLightRed, 
//     textAlign: 'center',
// };

// export const scoreBoxCellStyleScoreboard = {
//     display: 'flex',
//     justifyContent: 'center',
//     alignItems: 'center',
//     border: `3px solid ${primaryLightRed}`,
//     borderRadius: '12px',
//     margin: '0px 5px 10px 5px', 
//     padding: '10px', 
//     height: 'calc(75vh - 120px)', 
//     minHeight: '200px', 
//     maxHeight: '450px',
//     fontWeight: 'bold',
//     fontSize: 'clamp(3.5rem, 10vw, 6rem)', 
//     backgroundColor: 'white',
//     color: primaryLightRed,
// }; 