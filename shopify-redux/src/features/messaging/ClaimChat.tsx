import { useState, useEffect, useRef } from 'react';
import {
  Drawer, Box, Typography, TextField, IconButton, CircularProgress,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import {
  useGetClaimMessagesQuery,
  useSendMessageMutation,
  useMarkMessagesReadMutation,
} from '../../services/dbApi';
import { authApi } from '../../services/authApi';
import { MessageBubble } from './MessageBubble';
import { borderSubtle } from '../../theme';

interface ClaimChatProps {
  claimId: string;
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
}

const selectSessionQuery = authApi.endpoints.getSlimSession.select();

export const ClaimChat = ({ claimId, open, onClose, onBack }: ClaimChatProps) => {
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSelector(selectSessionQuery);
  const currentUserId = session?.user?.user_id;

  const { data: messages = [], isLoading } = useGetClaimMessagesQuery(
    { claimId },
    { skip: !open },
  );
  const [sendMessage, { isLoading: isSending }] = useSendMessageMutation();
  const [markRead] = useMarkMessagesReadMutation();

  // Mark messages as read when drawer opens
  useEffect(() => {
    if (open && claimId) {
      markRead(claimId);
    }
  }, [open, claimId, markRead]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = messageText.trim();
    if (!trimmed || isSending) return;

    try {
      await sendMessage({ claimId, body: trimmed }).unwrap();
      setMessageText('');
    } catch { /* handled by RTK Query */ }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 400 },
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${borderSubtle}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {onBack && (
            <IconButton onClick={onBack} size="small" sx={{ color: 'text.secondary' }}>
              <ArrowBackIcon />
            </IconButton>
          )}
          <Typography variant="h6" fontWeight={600}>
            Messages
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Messages area */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 2,
          py: 2,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : messages.length === 0 ? (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              opacity: 0.5,
            }}
          >
            <ChatBubbleOutlineIcon sx={{ fontSize: 40 }} />
            <Typography variant="body2" color="text.secondary">
              No messages yet. Start a conversation.
            </Typography>
          </Box>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isSent={msg.sender_user_id === currentUserId}
              />
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input area */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderTop: `1px solid ${borderSubtle}`,
          display: 'flex',
          gap: 1,
          alignItems: 'flex-end',
        }}
      >
        <TextField
          fullWidth
          multiline
          maxRows={4}
          size="small"
          placeholder="Type a message..."
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
          inputProps={{ maxLength: 2000 }}
        />
        <IconButton
          onClick={handleSend}
          disabled={!messageText.trim() || isSending}
          sx={{
            color: 'primary.main',
            '&.Mui-disabled': { color: 'text.secondary' },
          }}
        >
          {isSending ? <CircularProgress size={20} /> : <SendIcon />}
        </IconButton>
      </Box>
    </Drawer>
  );
};
