import {
  Drawer, Box, Typography, IconButton, CircularProgress, Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import { useGetUserOrdersQuery } from '../../services/authApi';
import { borderSubtle, glowMedium, statusColors } from '../../theme';

interface OrdersDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const OrdersDrawer = ({ open, onClose }: OrdersDrawerProps) => {
  const navigate = useNavigate();
  const { data: orders = [], isLoading } = useGetUserOrdersQuery(undefined, { skip: !open });

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 420 }, display: 'flex', flexDirection: 'column' },
      }}
    >
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${borderSubtle}` }}>
        <Typography variant="h6" fontWeight={600}>My Orders</Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}><CloseIcon /></IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
        ) : orders.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, px: 3 }}>
            <Typography variant="body1" color="text.secondary">No orders yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Upload a model and place an order to get started.
            </Typography>
          </Box>
        ) : (
          <Box>
            {orders.map((order: any) => {
              const statusColor = statusColors[order.status as keyof typeof statusColors] || '#8899AA';
              return (
                <Box
                  key={order.order_id}
                  onClick={() => { navigate(`/orders/${order.order_id}`); onClose(); }}
                  sx={{
                    px: 2.5, py: 2, cursor: 'pointer',
                    borderBottom: `1px solid ${borderSubtle}`,
                    '&:hover': { backgroundColor: 'rgba(0, 229, 255, 0.04)' },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="body1" fontWeight={600} noWrap sx={{ flex: 1, mr: 1 }}>
                      {order.name}
                    </Typography>
                    <Chip
                      label={order.status}
                      size="small"
                      sx={{
                        height: 22, fontSize: '0.7rem',
                        backgroundColor: `${statusColor}20`,
                        color: statusColor,
                        borderColor: `${statusColor}40`,
                        border: '1px solid',
                      }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      {order.material} · {order.technique} · ×{order.quantity}
                    </Typography>
                    <Typography variant="body2" sx={{ ml: 'auto', fontFamily: "'Roboto Mono', monospace", color: 'primary.main', fontWeight: 600 }}>
                      £{order.price?.toFixed(2)}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(order.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Drawer>
  );
};
