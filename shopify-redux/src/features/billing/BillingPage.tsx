import React from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Skeleton,
} from '@mui/material';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  useGetSubscriptionQuery,
  useGetTransactionsQuery,
  useManageBillingMutation,
  useCreateCheckoutMutation,
  useCreateCreditCheckoutMutation,
} from '../../services/authApi';
import { HeaderBar } from '../userInterface/headerBar';
import { borderSubtle, bgHighlight, glowSubtle, panelContainerSx, panelHeaderSx, panelBodySx } from '../../theme';

const tierColors: Record<string, string> = {
  free: '#8899AA',
  pro: '#00E5FF',
  enterprise: '#FFB300',
};

const BillingPage: React.FC = () => {
  const { data: subscription, isLoading: subLoading } = useGetSubscriptionQuery();
  const { data: txData, isLoading: txLoading } = useGetTransactionsQuery({ limit: 20, offset: 0 });
  const [manageBilling, { isLoading: manageLoading }] = useManageBillingMutation();
  const [createCheckout, { isLoading: checkoutLoading }] = useCreateCheckoutMutation();
  const [createCreditCheckout, { isLoading: creditLoading }] = useCreateCreditCheckoutMutation();

  const isLoading = manageLoading || checkoutLoading || creditLoading;

  const handleManage = async () => {
    try {
      const result = await manageBilling().unwrap();
      window.location.href = result.portal_url;
    } catch {
      // Error handled by RTK Query
    }
  };

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

  const tier = subscription?.tier || 'free';
  const color = tierColors[tier] || tierColors.free;

  return (
    <>
      <HeaderBar />
      <Box sx={{ maxWidth: 800, mx: 'auto', mt: 10, px: 2, pb: 6 }}>
        <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
          Billing
        </Typography>

        {/* Current Plan Card */}
        <Box sx={{ ...panelContainerSx, mb: 3 }}>
          <Box sx={panelHeaderSx}>
            <CreditCardIcon sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="subtitle2" fontWeight={600}>
              Current Plan
            </Typography>
          </Box>
          <Box sx={panelBodySx}>
            {subLoading ? (
              <Skeleton variant="rectangular" height={80} />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <Chip
                      label={tier.charAt(0).toUpperCase() + tier.slice(1)}
                      sx={{ fontWeight: 700, backgroundColor: color, color: '#0A0E14' }}
                    />
                    {subscription?.status && (
                      <Chip
                        label={subscription.status}
                        size="small"
                        variant="outlined"
                        sx={{
                          fontSize: '0.7rem',
                          height: 22,
                          borderColor: subscription.status === 'active' ? '#69F0AE' : 'error.main',
                          color: subscription.status === 'active' ? '#69F0AE' : 'error.main',
                        }}
                      />
                    )}
                  </Box>
                  {subscription?.current_period_end && (
                    <Typography variant="caption" color="text.secondary">
                      Current period ends: {new Date(subscription.current_period_end).toLocaleDateString()}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {tier !== 'free' && (
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={isLoading}
                      onClick={handleManage}
                      endIcon={manageLoading ? <CircularProgress size={14} /> : <OpenInNewIcon sx={{ fontSize: 14 }} />}
                    >
                      Manage Billing
                    </Button>
                  )}
                  {tier === 'free' && (
                    <Button
                      variant="contained"
                      size="small"
                      disabled={isLoading}
                      onClick={() => handleSubscribe('pro')}
                    >
                      Upgrade to Pro
                    </Button>
                  )}
                  {tier === 'pro' && (
                    <Button
                      variant="contained"
                      size="small"
                      disabled={isLoading}
                      onClick={() => handleSubscribe('enterprise')}
                      sx={{ backgroundColor: '#FFB300', '&:hover': { backgroundColor: '#FFA000' } }}
                    >
                      Upgrade to Enterprise
                    </Button>
                  )}
                </Box>
              </Box>
            )}
          </Box>
        </Box>

        {/* Credits Section */}
        <Box sx={{ ...panelContainerSx, mb: 3 }}>
          <Box sx={panelHeaderSx}>
            <Typography variant="subtitle2" fontWeight={600}>
              Credits
            </Typography>
          </Box>
          <Box sx={panelBodySx}>
            {subLoading ? (
              <Skeleton variant="rectangular" height={60} />
            ) : (
              <>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
                  <Typography variant="h3" fontWeight={700} sx={{ color: 'primary.main' }}>
                    {subscription?.available_credits ?? 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    credits available
                  </Typography>
                  {subscription?.credits_used !== undefined && (
                    <Typography variant="body2" color="text.secondary">
                      ({subscription.credits_used} used this period)
                    </Typography>
                  )}
                </Box>
                {subscription?.credit_renewal_date && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                    Credits renew on {new Date(subscription.credit_renewal_date).toLocaleDateString()}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={isLoading}
                    onClick={() => handleBuyCredits('small')}
                  >
                    Buy 10 credits — {'\u00a3'}2.99
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={isLoading}
                    onClick={() => handleBuyCredits('large')}
                  >
                    Buy 50 credits — {'\u00a3'}9.99
                  </Button>
                </Box>
              </>
            )}
          </Box>
        </Box>

        {/* Transaction History */}
        <Box sx={{ ...panelContainerSx }}>
          <Box sx={panelHeaderSx}>
            <ReceiptLongIcon sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="subtitle2" fontWeight={600}>
              Transaction History
            </Typography>
          </Box>
          <Box sx={{ p: 0 }}>
            {txLoading ? (
              <Box sx={{ p: 2 }}>
                <Skeleton variant="rectangular" height={120} />
              </Box>
            ) : !txData?.transactions?.length ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No transactions yet.
                </Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Credits</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {txData.transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <Typography variant="caption">
                            {new Date(tx.created_at).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{tx.description}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            sx={{ color: tx.credits > 0 ? '#69F0AE' : tx.credits < 0 ? 'error.main' : 'text.secondary' }}
                          >
                            {tx.credits > 0 ? '+' : ''}{tx.credits}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="caption" color="text.secondary">
                            {tx.amount_cents > 0 ? `\u00a3${(tx.amount_cents / 100).toFixed(2)}` : '-'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default BillingPage;
