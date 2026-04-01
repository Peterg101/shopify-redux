import { useState } from 'react';
import {
  Drawer, Box, Typography, IconButton, List, ListItemButton, ListItemText,
  Badge, Chip, CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useGetConversationsQuery } from '../../services/dbApi';
import { ClaimChat } from './ClaimChat';
import { borderSubtle, glowMedium } from '../../theme';

interface MessagesDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const MessagesDrawer = ({ open, onClose }: MessagesDrawerProps) => {
  const { data: conversations = [], isLoading } = useGetConversationsQuery(undefined, { skip: !open });
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  const handleClose = () => {
    setSelectedClaimId(null);
    onClose();
  };

  const handleBack = () => {
    setSelectedClaimId(null);
  };

  // If a claim is selected, show the chat directly in the drawer
  if (selectedClaimId) {
    return (
      <ClaimChat
        claimId={selectedClaimId}
        open={open}
        onClose={handleClose}
        onBack={handleBack}
      />
    );
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
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
        <Typography variant="h6" fontWeight={600}>
          Messages
        </Typography>
        <IconButton onClick={handleClose} size="small" sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Conversations List */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : conversations.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, px: 3 }}>
            <ChatBubbleOutlineIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              No conversations yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Messages will appear here when you communicate about claims.
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {conversations.map((conv: any, idx: number) => {
              const timeStr = conv.last_message
                ? new Date(conv.last_message.created_at).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  })
                : '';

              return (
                <ListItemButton
                  key={conv.id}
                  onClick={() => setSelectedClaimId(conv.claim_id)}
                  sx={{
                    py: 2,
                    px: 2.5,
                    borderBottom: idx < conversations.length - 1
                      ? `1px solid ${borderSubtle}`
                      : 'none',
                    '&:hover': { backgroundColor: 'rgba(0, 229, 255, 0.04)' },
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1" fontWeight={conv.unread_count > 0 ? 700 : 400} noWrap sx={{ flex: 1 }}>
                          {conv.order_name || 'Order'}
                        </Typography>
                        {conv.claim_status && (
                          <Chip
                            label={conv.claim_status.replace(/_/g, ' ')}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.65rem',
                              textTransform: 'capitalize',
                              backgroundColor: glowMedium,
                              color: 'primary.main',
                            }}
                          />
                        )}
                        {timeStr && (
                          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                            {timeStr}
                          </Typography>
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        {conv.other_username && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            with {conv.other_username}
                          </Typography>
                        )}
                        {conv.last_message ? (
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{
                            mt: 0.5,
                            fontWeight: conv.unread_count > 0 ? 600 : 400,
                            color: conv.unread_count > 0 ? 'text.primary' : 'text.secondary',
                          }}
                        >
                          {conv.last_message.body}
                        </Typography>
                      ) : null}
                      </Box>
                    }
                  />
                  {conv.unread_count > 0 && (
                    <Badge
                      badgeContent={conv.unread_count}
                      color="primary"
                      sx={{
                        ml: 2,
                        '& .MuiBadge-badge': {
                          backgroundColor: '#00E5FF',
                          color: '#0A0E14',
                          fontWeight: 700,
                        },
                      }}
                    />
                  )}
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Box>
    </Drawer>
  );
};
