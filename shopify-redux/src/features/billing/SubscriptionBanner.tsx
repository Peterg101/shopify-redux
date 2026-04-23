import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { useGetSlimSessionQuery } from '../../services/authApi';
import { bgHighlight, borderSubtle, glowSubtle } from '../../theme';

const tierColors: Record<string, string> = {
  free: '#8899AA',
  pro: '#00E5FF',
  enterprise: '#FFB300',
};

const SubscriptionBanner: React.FC = () => {
  const { data: session } = useGetSlimSessionQuery();

  if (!session) return null;

  const { subscription_tier, subscription_status, available_credits } = session;
  const tier = subscription_tier || 'free';
  const color = tierColors[tier] || tierColors.free;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 1.5,
        py: 0.5,
        borderRadius: 2,
        border: `1px solid ${borderSubtle}`,
        backgroundColor: bgHighlight,
        boxShadow: `0 0 6px ${glowSubtle}`,
      }}
    >
      <Chip
        label={tier.charAt(0).toUpperCase() + tier.slice(1)}
        size="small"
        sx={{
          fontSize: '0.7rem',
          height: 22,
          fontWeight: 700,
          color: '#0A0E14',
          backgroundColor: color,
        }}
      />

      {subscription_status === 'past_due' ? (
        <Typography
          variant="caption"
          component={Link}
          to="/billing"
          sx={{ color: 'error.main', textDecoration: 'none', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}
        >
          Payment failed — update billing
        </Typography>
      ) : available_credits === 0 ? (
        <Typography
          variant="caption"
          component={Link}
          to="/billing"
          sx={{ color: 'warning.main', textDecoration: 'none', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}
        >
          No credits — Upgrade
        </Typography>
      ) : (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {available_credits} credit{available_credits !== 1 ? 's' : ''} left
        </Typography>
      )}
    </Box>
  );
};

export default SubscriptionBanner;
