import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Divider,
} from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import StarIcon from '@mui/icons-material/Star';
import { useGetSlimSessionQuery, useCreateCheckoutMutation, useCreateCreditCheckoutMutation } from '../../services/authApi';
import { borderSubtle, bgHighlight, glowSubtle } from '../../theme';

export interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason: 'no_credits' | 'pro_required';
}

const tiers = [
  {
    name: 'Free',
    price: 'Free',
    credits: '5 / month',
    features: ['Basic CAD generation', '5 credits per month', 'Community support'],
    color: '#8899AA',
  },
  {
    name: 'Pro',
    price: '\u00a39.99/mo',
    credits: '50 / month',
    features: ['Priority CAD generation', '50 credits per month', 'Refinement iterations', 'Email support'],
    color: '#00E5FF',
    tier: 'pro' as const,
  },
  {
    name: 'Enterprise',
    price: '\u00a349.99/mo',
    credits: '500 / month',
    features: ['Unlimited priority generation', '500 credits per month', 'Advanced refinement', 'Dedicated support', 'Custom processes'],
    color: '#FFB300',
    tier: 'enterprise' as const,
  },
];

const UpgradeModal: React.FC<UpgradeModalProps> = ({ open, onClose, reason }) => {
  const { data: session } = useGetSlimSessionQuery();
  const [createCheckout, { isLoading: checkoutLoading }] = useCreateCheckoutMutation();
  const [createCreditCheckout, { isLoading: creditLoading }] = useCreateCreditCheckoutMutation();

  const currentTier = session?.subscription_tier || 'free';
  const isLoading = checkoutLoading || creditLoading;

  const handleSubscribe = async (tier: 'pro' | 'enterprise') => {
    try {
      const result = await createCheckout({ tier }).unwrap();
      window.location.href = result.checkout_url;
    } catch {
      // Error handled by RTK Query
    }
  };

  const handleBuyCredits = async (pack: 'small' | 'large') => {
    try {
      const result = await createCreditCheckout({ pack }).unwrap();
      window.location.href = result.checkout_url;
    } catch {
      // Error handled by RTK Query
    }
  };

  const title = reason === 'no_credits' ? 'Upgrade to Continue' : 'Pro Feature';
  const subtitle =
    reason === 'no_credits'
      ? "You've used all your credits for this period. Upgrade your plan or buy more credits to keep generating."
      : 'This feature requires a Pro or Enterprise subscription.';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <RocketLaunchIcon sx={{ color: 'primary.main' }} />
        {title}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {subtitle}
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          {tiers.map((t) => {
            const isCurrent = t.name.toLowerCase() === currentTier;
            return (
              <Card
                key={t.name}
                sx={{
                  flex: '1 1 220px',
                  maxWidth: 280,
                  border: isCurrent ? `2px solid ${t.color}` : `1px solid ${borderSubtle}`,
                  backgroundColor: isCurrent ? bgHighlight : 'background.paper',
                  boxShadow: isCurrent ? `0 0 12px ${glowSubtle}` : undefined,
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="h6" fontWeight={700}>
                      {t.name}
                    </Typography>
                    {isCurrent && (
                      <Chip label="Current" size="small" sx={{ fontSize: '0.65rem', height: 20, backgroundColor: t.color, color: '#0A0E14' }} />
                    )}
                  </Box>
                  <Typography variant="h5" fontWeight={700} sx={{ color: t.color, mb: 0.5 }}>
                    {t.price}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t.credits} credits
                  </Typography>
                  <Divider sx={{ my: 1.5 }} />
                  {t.features.map((f) => (
                    <Box key={f} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <StarIcon sx={{ fontSize: 12, color: t.color }} />
                      <Typography variant="caption">{f}</Typography>
                    </Box>
                  ))}
                  {t.tier && !isCurrent && (
                    <Button
                      variant="contained"
                      fullWidth
                      size="small"
                      disabled={isLoading}
                      onClick={() => handleSubscribe(t.tier!)}
                      sx={{
                        mt: 2,
                        backgroundColor: t.color,
                        color: '#0A0E14',
                        '&:hover': { backgroundColor: t.color, opacity: 0.85 },
                      }}
                    >
                      Subscribe to {t.name}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Box>

        {/* Credit packs — show for paid tiers with no credits */}
        {reason === 'no_credits' && currentTier !== 'free' && (
          <>
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
              Or buy additional credits
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                disabled={isLoading}
                onClick={() => handleBuyCredits('small')}
                sx={{ flex: 1 }}
              >
                10 credits — {'\u00a3'}2.99
              </Button>
              <Button
                variant="outlined"
                disabled={isLoading}
                onClick={() => handleBuyCredits('large')}
                sx={{ flex: 1 }}
              >
                50 credits — {'\u00a3'}9.99
              </Button>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UpgradeModal;
