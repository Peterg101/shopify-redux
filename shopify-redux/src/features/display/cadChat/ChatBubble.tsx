import React from 'react';
import { Box, Typography } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { ChatMessage } from '../../../app/utility/interfaces';
import { bgHighlightHover, bgPaper, borderSubtle, glowSubtle } from '../../../theme';
import SpecConfirmation from './SpecConfirmation';

interface ChatBubbleProps {
  message: ChatMessage;
  onApprove?: (spec: Record<string, any>) => void;
  onEdit?: () => void;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message, onApprove, onEdit }) => {
  const isUser = message.role === 'user';
  const isConfirmation = message.phase === 'confirmation' && message.spec;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        mb: 1.5,
      }}
    >
      {/* Avatar + label for assistant */}
      {!isUser && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, ml: 0.5 }}>
          <SmartToyIcon sx={{ fontSize: 14, color: 'primary.main' }} />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
            FITD Engineer
          </Typography>
        </Box>
      )}

      {/* Message bubble */}
      <Box
        sx={{
          maxWidth: '85%',
          px: 2,
          py: 1.5,
          borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
          backgroundColor: isUser ? bgHighlightHover : bgPaper,
          border: `1px solid ${isUser ? 'rgba(0, 229, 255, 0.2)' : borderSubtle}`,
          boxShadow: isUser ? `0 0 8px ${glowSubtle}` : 'none',
        }}
      >
        <Typography
          variant="body2"
          sx={{
            whiteSpace: 'pre-wrap',
            lineHeight: 1.6,
            '& strong': { color: 'primary.main' },
          }}
        >
          {message.content}
        </Typography>

        {/* Render attached images */}
        {message.images && message.images.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
            {message.images.map((img, i) => (
              <Box
                key={i}
                component="img"
                src={img.startsWith('data:') ? img : `data:image/png;base64,${img}`}
                alt={`Attachment ${i + 1}`}
                sx={{
                  maxWidth: 200,
                  maxHeight: 150,
                  borderRadius: 1,
                  border: `1px solid ${borderSubtle}`,
                }}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Spec confirmation card */}
      {isConfirmation && message.spec && onApprove && onEdit && (
        <Box sx={{ maxWidth: '85%', mt: 1 }}>
          <SpecConfirmation
            spec={message.spec}
            onApprove={onApprove}
            onEdit={onEdit}
          />
        </Box>
      )}
    </Box>
  );
};

export default ChatBubble;
