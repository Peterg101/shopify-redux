import { useSelector } from "react-redux"
import { Box, LinearProgress, Typography } from "@mui/material"
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh"
import AccountTreeIcon from "@mui/icons-material/AccountTree"
import { RootState } from "../../app/store";
import { keyframes } from "@mui/material/styles";
import { bgHighlightHover, monoFontFamily } from "../../theme";

const pulseGlow = keyframes`
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
`;

const bounce = keyframes`
  0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
`;

const BouncingDots = () => (
    <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'center' }}>
        {[0, 1, 2].map((i) => (
            <Box
                key={i}
                sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: 'primary.main',
                    animation: `${bounce} 1.2s ease-in-out infinite`,
                    animationDelay: `${i * 0.16}s`,
                }}
            />
        ))}
    </Box>
);

export const RefiningOverlay = () => {
    const cadState = useSelector((state: RootState) => state.cadState);

    // Detect if this is a suppression (fast, no LLM) vs refinement (slower, LLM-powered)
    const statusMsg = cadState.cadStatusMessage || '';
    const isSuppression = statusMsg.includes('suppress') || statusMsg.includes('dependencies');

    return (
        <Box
            sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                backgroundColor: 'rgba(10, 14, 20, 0.75)',
                backdropFilter: 'blur(4px)',
                borderRadius: 3,
                zIndex: 10,
            }}
        >
            {isSuppression ? (
                <>
                    <AccountTreeIcon
                        sx={{
                            fontSize: 36,
                            color: 'primary.main',
                            animation: `${pulseGlow} 1.5s ease-in-out infinite`,
                        }}
                    />
                    <Typography variant="body1" color="text.primary" fontWeight={600}>
                        Updating model
                    </Typography>
                    <BouncingDots />
                </>
            ) : (
                <>
                    <AutoFixHighIcon
                        sx={{
                            fontSize: 40,
                            color: 'primary.main',
                            animation: `${pulseGlow} 2s ease-in-out infinite`,
                        }}
                    />
                    <Typography variant="h6" color="text.primary" fontWeight={600}>
                        Refining model...
                    </Typography>
                    {cadState.cadStatusMessage && (
                        <Typography variant="body2" color="text.secondary">
                            {cadState.cadStatusMessage}
                        </Typography>
                    )}
                    {cadState.cadLoading && (
                        <Box sx={{ width: '50%', maxWidth: 260, textAlign: 'center' }}>
                            <Typography
                                variant="h4"
                                color="primary.main"
                                fontWeight={700}
                                sx={{ fontFamily: monoFontFamily, mb: 1 }}
                            >
                                {cadState.cadLoadedPercentage}%
                            </Typography>
                            <LinearProgress
                                variant="determinate"
                                value={cadState.cadLoadedPercentage}
                                sx={{
                                    height: 6,
                                    borderRadius: 3,
                                    backgroundColor: bgHighlightHover,
                                    '& .MuiLinearProgress-bar': { borderRadius: 3 },
                                }}
                            />
                        </Box>
                    )}
                </>
            )}
        </Box>
    );
};
