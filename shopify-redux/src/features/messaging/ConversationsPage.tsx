import { useState } from 'react';
import {
  Box, Typography, Paper, List, ListItemButton, ListItemText, Badge,
  CircularProgress, Chip,
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useGetConversationsQuery } from '../../services/dbApi';
import { borderSubtle, glowMedium } from '../../theme';
import { ClaimChat } from './ClaimChat';

export const ConversationsPage = () => {
  const { data: conversations = [], isLoading } = useGetConversationsQuery();
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', px: 2, py: 4 }}>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
        Messages
      </Typography>

      {conversations.length === 0 ? (
        <Paper
          sx={{
            p: 6,
            textAlign: 'center',
            border: `1px solid ${borderSubtle}`,
            backgroundColor: 'rgba(19, 25, 32, 0.85)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <ChatBubbleOutlineIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No conversations yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Messages will appear here when you communicate with buyers or fulfillers about claims.
          </Typography>
        </Paper>
      ) : (
        <Paper
          sx={{
            border: `1px solid ${borderSubtle}`,
            backgroundColor: 'rgba(19, 25, 32, 0.85)',
            backdropFilter: 'blur(12px)',
            overflow: 'hidden',
          }}
        >
          <List disablePadding>
            {conversations.map((conv, idx) => {
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
                        <Typography variant="body1" fontWeight={conv.unread_count > 0 ? 700 : 400}>
                          Claim
                        </Typography>
                        <Chip
                          label={conv.claim_id.slice(0, 8)}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.7rem',
                            backgroundColor: glowMedium,
                            color: 'primary.main',
                          }}
                        />
                        {timeStr && (
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                            {timeStr}
                          </Typography>
                        )}
                      </Box>
                    }
                    secondary={
                      conv.last_message ? (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          noWrap
                          sx={{
                            mt: 0.5,
                            fontWeight: conv.unread_count > 0 ? 600 : 400,
                            color: conv.unread_count > 0 ? 'text.primary' : 'text.secondary',
                          }}
                        >
                          {conv.last_message.body}
                        </Typography>
                      ) : null
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
        </Paper>
      )}

      {selectedClaimId && (
        <ClaimChat
          claimId={selectedClaimId}
          open={!!selectedClaimId}
          onClose={() => setSelectedClaimId(null)}
        />
      )}
    </Box>
  );
};
