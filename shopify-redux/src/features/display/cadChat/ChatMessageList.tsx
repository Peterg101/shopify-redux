import React, { useRef, useEffect } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { ChatMessage } from '../../../app/utility/interfaces';
import ChatBubble from './ChatBubble';
import { glowSubtle } from '../../../theme';

interface ChatMessageListProps {
  messages: ChatMessage[];
  isWaiting: boolean;
  onApprove: (spec: Record<string, any>) => void;
  onEdit: () => void;
}

const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  isWaiting,
  onApprove,
  onEdit,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isWaiting]);

  if (messages.length === 0 && !isWaiting) return null;

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        px: 1,
        py: 1,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(0, 229, 255, 0.2)',
          borderRadius: 2,
        },
      }}
    >
      {messages.map((msg) => (
        <ChatBubble
          key={msg.id}
          message={msg}
          onApprove={onApprove}
          onEdit={onEdit}
        />
      ))}

      {/* Typing indicator */}
      {isWaiting && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1, mb: 1 }}>
          <CircularProgress size={14} sx={{ color: 'primary.main' }} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Thinking...
          </Typography>
        </Box>
      )}

      <div ref={bottomRef} />
    </Box>
  );
};

export default ChatMessageList;
