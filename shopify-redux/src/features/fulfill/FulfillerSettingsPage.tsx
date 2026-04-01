import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Box, Container, Typography, Button, Chip, CircularProgress,
  Grid, Collapse, IconButton,
} from '@mui/material';
import PaymentIcon from '@mui/icons-material/Payment';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../app/store';
import { authApi } from '../../services/authApi';
import { useGetFulfillerProfileQuery } from '../../services/dbApi';
import { callStripeService } from '../../services/fetchFileUtils';
import { FulfillerCapabilityForm } from './FulfillerCapabilityForm';
import { FulfillerCapabilityDisplay } from './FulfillerCapabilityDisplay';
import { FulfillerAddressForm } from './FulfillerAddressForm';
import { HeaderBar } from '../userInterface/headerBar';
import { borderSubtle, borderHover, glowSubtle, bgHighlight, monoFontFamily } from '../../theme';

const STEPS = [
  { key: 'stripe', label: 'Payments', icon: PaymentIcon, description: 'Connect Stripe to receive payouts for fulfilled orders' },
  { key: 'capabilities', label: 'Capabilities', icon: PrecisionManufacturingIcon, description: 'Declare your manufacturing processes, materials, and machine specifications' },
  { key: 'address', label: 'Shipping', icon: LocalShippingIcon, description: 'Set your shipping origin for rate calculation and return labels' },
] as const;

export const FulfillerSettingsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const userInfo = useSelector((state: RootState) => state.userInterfaceState.userInformation);
  const userId = userInfo?.user?.user_id;
  const { data: fulfillerProfile } = useGetFulfillerProfileQuery(userId!, { skip: !userId });

  const [showCapabilityForm, setShowCapabilityForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const stripeReady = !!userInfo?.stripe_onboarded;
  const profileReady = !!fulfillerProfile;
  const addressReady = profileReady;

  const completionMap: Record<string, boolean> = {
    stripe: stripeReady,
    capabilities: profileReady,
    address: addressReady,
  };
  const completedCount = Object.values(completionMap).filter(Boolean).length;
  const progressPercent = (completedCount / 3) * 100;

  const handleRefreshSession = () => {
    setRefreshing(true);
    dispatch(authApi.util.invalidateTags(['sessionData']));
    setTimeout(() => setRefreshing(false), 2000);
  };

  const toggleSection = (key: string) => {
    setExpandedSection(prev => prev === key ? null : key);
  };

  return (
    <Box>
      <HeaderBar />
      <Container maxWidth="lg" sx={{ pt: 12, pb: 8 }}>
        {/* Page Header */}
        <Box sx={{ mb: 5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <IconButton onClick={() => navigate(-1)} size="small" sx={{ color: 'text.secondary' }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, #E4E8EE 0%, #00E5FF 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Fulfiller Onboarding
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ ml: 6 }}>
            Complete these steps to start claiming and fulfilling manufacturing orders.
          </Typography>
        </Box>

        {/* Progress Overview */}
        <Box
          sx={{
            mb: 5, p: 3, borderRadius: 3,
            border: `1px solid ${borderSubtle}`,
            background: 'rgba(19, 25, 32, 0.85)',
            backdropFilter: 'blur(12px)',
            position: 'relative', overflow: 'hidden',
          }}
        >
          <Box sx={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 3,
            background: completedCount === 3
              ? 'linear-gradient(90deg, #69F0AE, #00E5FF)'
              : `linear-gradient(90deg, #00E5FF ${progressPercent}%, ${borderSubtle} ${progressPercent}%)`,
          }} />

          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <Typography sx={{
                  fontSize: '3rem', fontWeight: 900, fontFamily: monoFontFamily,
                  color: completedCount === 3 ? '#69F0AE' : '#00E5FF', lineHeight: 1,
                }}>
                  {completedCount}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontFamily: monoFontFamily }}>
                  / 3
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {completedCount === 3 ? "All steps complete — you're ready to fulfil!" : 'steps complete'}
              </Typography>
            </Grid>

            <Grid item xs={12} md={8}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                {STEPS.map((step) => {
                  const done = completionMap[step.key];
                  return (
                    <Box
                      key={step.key}
                      onClick={() => toggleSection(step.key)}
                      sx={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 0.75, py: 1.5, px: 1,
                        borderRadius: 2, cursor: 'pointer',
                        border: `1px solid ${expandedSection === step.key ? borderHover : 'transparent'}`,
                        backgroundColor: expandedSection === step.key ? bgHighlight : 'transparent',
                        transition: 'all 0.2s ease',
                        '&:hover': { backgroundColor: bgHighlight, border: `1px solid ${borderSubtle}` },
                      }}
                    >
                      <Box sx={{ position: 'relative' }}>
                        <step.icon sx={{ fontSize: 28, color: done ? '#69F0AE' : '#8899AA', transition: 'color 0.3s ease' }} />
                        {done && (
                          <CheckCircleIcon sx={{
                            position: 'absolute', bottom: -4, right: -6, fontSize: 14,
                            color: '#69F0AE', backgroundColor: '#131920', borderRadius: '50%',
                          }} />
                        )}
                      </Box>
                      <Typography variant="caption" sx={{
                        fontWeight: 600, color: done ? '#E4E8EE' : '#8899AA',
                        textAlign: 'center', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1,
                      }}>
                        {step.label}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* Section Cards */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* 1. Stripe */}
          <SectionCard
            icon={PaymentIcon} title="Payment Account"
            description="Connect your Stripe account to receive payouts when you fulfil orders."
            done={stripeReady} expanded={expandedSection === 'stripe'}
            onToggle={() => toggleSection('stripe')}
          >
            {stripeReady ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
                <Chip label="Payments Active" color="success" variant="outlined" sx={{ fontWeight: 600, borderWidth: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  Your Stripe account is connected and ready to receive payouts.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <Button variant="contained" onClick={callStripeService}
                  sx={{ textTransform: 'none', fontWeight: 600, px: 3, boxShadow: `0 0 20px ${glowSubtle}` }}>
                  Connect Stripe Account
                </Button>
                <Button variant="outlined" onClick={handleRefreshSession} disabled={refreshing}
                  startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
                  sx={{ textTransform: 'none' }}>
                  {refreshing ? 'Checking…' : 'Check Status'}
                </Button>
              </Box>
            )}
          </SectionCard>

          {/* 2. Manufacturing */}
          <SectionCard
            icon={PrecisionManufacturingIcon} title="Manufacturing Capabilities"
            description="Declare your available processes, materials, build volume, and certifications."
            done={profileReady} expanded={expandedSection === 'capabilities'}
            onToggle={() => toggleSection('capabilities')}
            action={
              fulfillerProfile && !showCapabilityForm ? (
                <Button size="small" variant="outlined"
                  onClick={(e) => { e.stopPropagation(); setShowCapabilityForm(true); }}
                  sx={{ textTransform: 'none', minWidth: 0 }}>
                  Edit
                </Button>
              ) : undefined
            }
          >
            {showCapabilityForm ? (
              <FulfillerCapabilityForm existingProfile={fulfillerProfile} onComplete={() => setShowCapabilityForm(false)} />
            ) : fulfillerProfile ? (
              <FulfillerCapabilityDisplay profile={fulfillerProfile} />
            ) : (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Set up your manufacturing profile so buyers can find orders that match your capabilities.
                </Typography>
                <Button variant="contained" onClick={() => setShowCapabilityForm(true)}
                  sx={{ textTransform: 'none', fontWeight: 600, px: 3, boxShadow: `0 0 20px ${glowSubtle}` }}>
                  Create Manufacturing Profile
                </Button>
              </Box>
            )}
          </SectionCard>

          {/* 3. Shipping */}
          <SectionCard
            icon={LocalShippingIcon} title="Shipping Address"
            description="Your shipping origin for rate calculation and return labels."
            done={addressReady} expanded={expandedSection === 'address'}
            onToggle={() => toggleSection('address')}
            disabled={!profileReady} disabledReason="Complete your manufacturing profile first"
          >
            <FulfillerAddressForm />
          </SectionCard>
        </Box>
      </Container>
    </Box>
  );
};

/* ── Reusable Section Card ── */
interface SectionCardProps {
  icon: typeof PaymentIcon;
  title: string;
  description: string;
  done: boolean;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  action?: React.ReactNode;
  disabled?: boolean;
  disabledReason?: string;
}

const SectionCard = ({
  icon: Icon, title, description, done, expanded, onToggle,
  children, action, disabled, disabledReason,
}: SectionCardProps) => (
  <Box
    sx={{
      borderRadius: 3,
      border: `1px solid ${expanded ? borderHover : borderSubtle}`,
      background: 'rgba(19, 25, 32, 0.85)',
      backdropFilter: 'blur(12px)',
      transition: 'all 0.25s ease',
      opacity: disabled ? 0.5 : 1,
      '&:hover': disabled ? {} : { borderColor: borderHover, boxShadow: `0 0 24px ${glowSubtle}` },
    }}
  >
    <Box
      onClick={disabled ? undefined : onToggle}
      sx={{
        display: 'flex', alignItems: 'center', gap: 2,
        px: 3, py: 2.5, cursor: disabled ? 'default' : 'pointer', userSelect: 'none',
      }}
    >
      <Box sx={{ position: 'relative', flexShrink: 0 }}>
        <Box sx={{
          width: 48, height: 48, borderRadius: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: done
            ? 'linear-gradient(135deg, rgba(105,240,174,0.15), rgba(0,229,255,0.08))'
            : bgHighlight,
          border: `1px solid ${done ? 'rgba(105,240,174,0.3)' : borderSubtle}`,
        }}>
          <Icon sx={{ fontSize: 24, color: done ? '#69F0AE' : '#00E5FF' }} />
        </Box>
        {done && (
          <CheckCircleIcon sx={{
            position: 'absolute', bottom: -4, right: -4, fontSize: 18,
            color: '#69F0AE', backgroundColor: '#0A0E14', borderRadius: '50%',
          }} />
        )}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {disabled ? disabledReason : description}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        {!done && !disabled && (
          <Chip label="Required" size="small" sx={{
            height: 22, fontSize: '0.65rem', fontWeight: 700, letterSpacing: 0.5,
            backgroundColor: 'rgba(255, 145, 0, 0.12)', color: '#FF9100',
            border: '1px solid rgba(255, 145, 0, 0.25)',
            display: { xs: 'none', sm: 'flex' },
          }} />
        )}
        {action}
        {!disabled && (
          <IconButton size="small" sx={{ color: 'text.secondary' }}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        )}
      </Box>
    </Box>

    <Collapse in={expanded && !disabled}>
      <Box sx={{ px: 3, pb: 3, borderTop: `1px solid ${borderSubtle}`, pt: 2.5 }}>
        {children}
      </Box>
    </Collapse>
  </Box>
);
