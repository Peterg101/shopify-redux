import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Chip, CircularProgress,
  TextField, InputAdornment, IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useGetUserOrdersQuery } from '../../services/authApi';
import { HeaderBar } from '../userInterface/headerBar';
import { ClaimChat } from '../messaging/ClaimChat';
import { borderSubtle, borderHover, glowSubtle, bgHighlight, monoFontFamily, statusColors } from '../../theme';

export const OrdersPage = () => {
  const navigate = useNavigate();
  const { data: orders = [], isLoading } = useGetUserOrdersQuery();
  const [search, setSearch] = useState('');
  const [chatClaimId, setChatClaimId] = useState<string | null>(null);

  const filtered = search.trim()
    ? orders.filter((o: any) =>
        o.name.toLowerCase().includes(search.toLowerCase()) ||
        o.material.toLowerCase().includes(search.toLowerCase())
      )
    : orders;

  return (
    <Box>
      <HeaderBar />
      <Container maxWidth="lg" sx={{ pt: 12, pb: 8 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <IconButton onClick={() => navigate(-1)} size="small" sx={{ color: 'text.secondary' }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
            My Orders
          </Typography>
          <Chip
            label={orders.length}
            size="small"
            sx={{
              height: 24, fontFamily: monoFontFamily, fontWeight: 700,
              backgroundColor: 'rgba(0, 229, 255, 0.12)', color: '#00E5FF',
            }}
          />
        </Box>
        <Typography variant="body1" color="text.secondary" sx={{ ml: 6, mb: 4 }}>
          Track your manufacturing orders and communicate with fulfillers.
        </Typography>

        {/* Search */}
        {orders.length > 3 && (
          <TextField
            size="small"
            fullWidth
            placeholder="Search orders by name or material..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 3, maxWidth: 500 }}
          />
        )}

        {/* Loading */}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Empty state */}
        {!isLoading && orders.length === 0 && (
          <Box sx={{
            textAlign: 'center', py: 8,
            border: `1px solid ${borderSubtle}`, borderRadius: 3,
            background: 'rgba(19, 25, 32, 0.85)', backdropFilter: 'blur(12px)',
          }}>
            <Typography variant="h6" color="text.secondary">No orders yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Upload a 3D model and place an order to get started.
            </Typography>
          </Box>
        )}

        {/* Order list */}
        {!isLoading && filtered.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {filtered.map((order: any) => {
              const statusColor = statusColors[order.status as keyof typeof statusColors] || '#8899AA';
              const progress = order.quantity > 0 ? (order.quantity_claimed / order.quantity) * 100 : 0;
              const hasClaims = order.claims && order.claims.length > 0;

              return (
                <Box
                  key={order.order_id}
                  sx={{
                    borderRadius: 3,
                    border: `1px solid ${borderSubtle}`,
                    background: 'rgba(19, 25, 32, 0.85)',
                    backdropFilter: 'blur(12px)',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                    '&:hover': { borderColor: borderHover, boxShadow: `0 0 20px ${glowSubtle}` },
                  }}
                >
                  {/* Main row — clickable */}
                  <Box
                    onClick={() => navigate(`/orders/${order.order_id}`)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 2,
                      px: 3, py: 2.5, cursor: 'pointer',
                    }}
                  >
                    {/* Status dot */}
                    <Box sx={{
                      width: 10, height: 10, borderRadius: '50%',
                      backgroundColor: statusColor, flexShrink: 0,
                      boxShadow: `0 0 8px ${statusColor}60`,
                    }} />

                    {/* Info */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                        <Typography variant="body1" fontWeight={700} noWrap sx={{ flex: 1 }}>
                          {order.name}
                        </Typography>
                        <Chip
                          label={order.status.replace(/_/g, ' ')}
                          size="small"
                          sx={{
                            height: 22, fontSize: '0.7rem', fontWeight: 600,
                            textTransform: 'capitalize',
                            backgroundColor: `${statusColor}18`,
                            color: statusColor,
                            border: `1px solid ${statusColor}35`,
                          }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="body2" color="text.secondary">
                          {order.material} · {order.technique}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          ×{order.quantity}
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: monoFontFamily, color: '#00E5FF', fontWeight: 600 }}>
                          £{order.price?.toFixed(2)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                          {new Date(order.created_at).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Fulfillment progress bar */}
                  {order.quantity_claimed > 0 && (
                    <Box sx={{ px: 3, pb: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Box sx={{ flex: 1, height: 3, backgroundColor: 'rgba(0, 229, 255, 0.08)', borderRadius: 2, overflow: 'hidden' }}>
                          <Box sx={{ height: '100%', width: `${progress}%`, backgroundColor: '#00E5FF', borderRadius: 2, transition: 'width 0.3s ease' }} />
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: monoFontFamily, fontSize: '0.65rem' }}>
                          {order.quantity_claimed}/{order.quantity}
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {/* Claims with chat buttons */}
                  {hasClaims && (
                    <Box sx={{ borderTop: `1px solid ${borderSubtle}`, px: 3, py: 1.5 }}>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                          Claims:
                        </Typography>
                        {order.claims.map((claim: any) => {
                          const claimColor = statusColors[claim.status as keyof typeof statusColors] || '#8899AA';
                          return (
                            <Box key={claim.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Chip
                                label={`${claim.claimant_username || 'Fulfiller'} · ${claim.status.replace(/_/g, ' ')}`}
                                size="small"
                                sx={{
                                  height: 24, fontSize: '0.7rem',
                                  backgroundColor: `${claimColor}12`,
                                  color: claimColor,
                                  border: `1px solid ${claimColor}25`,
                                  textTransform: 'capitalize',
                                }}
                              />
                              <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); setChatClaimId(claim.id); }}
                                sx={{
                                  width: 28, height: 28,
                                  color: '#00E5FF',
                                  '&:hover': { backgroundColor: bgHighlight },
                                }}
                              >
                                <ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        )}

        {/* No search results */}
        {!isLoading && search && filtered.length === 0 && orders.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No orders matching "{search}"
          </Typography>
        )}
      </Container>

      {/* Chat drawer */}
      {chatClaimId && (
        <ClaimChat
          claimId={chatClaimId}
          open={!!chatClaimId}
          onClose={() => setChatClaimId(null)}
        />
      )}
    </Box>
  );
};
