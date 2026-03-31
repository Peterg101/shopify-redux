import { Box, Typography } from '@mui/material';
import { MessageResponse } from '../../app/utility/interfaces';
import { borderSubtle } from '../../theme';

interface MessageBubbleProps {
  message: MessageResponse;
  isSent: boolean;
}

export const MessageBubble = ({ message, isSent }: MessageBubbleProps) => {
  const timestamp = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isSent ? 'flex-end' : 'flex-start',
        mb: 1,
      }}
    >
      <Box
        sx={{
          maxWidth: '75%',
          px: 1.5,
          py: 1,
          borderRadius: 2,
          backgroundColor: isSent
            ? 'rgba(0, 229, 255, 0.15)'
            : 'rgba(136, 153, 170, 0.1)',
          border: `1px solid ${isSent ? 'rgba(0, 229, 255, 0.25)' : borderSubtle}`,
        }}
      >
        <Typography variant="body2" sx={{ color: 'text.primary', wordBreak: 'break-word' }}>
          {message.body}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', display: 'block', textAlign: 'right', mt: 0.5 }}
        >
          {timestamp}
        </Typography>
      </Box>
    </Box>
  );
};
