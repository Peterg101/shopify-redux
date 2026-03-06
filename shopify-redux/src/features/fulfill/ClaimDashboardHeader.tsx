import { Box, Typography, Chip, LinearProgress } from '@mui/material'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import BuildIcon from '@mui/icons-material/Build'
import PrintIcon from '@mui/icons-material/Print'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import GavelIcon from '@mui/icons-material/Gavel'
import CancelIcon from '@mui/icons-material/Cancel'
import { Claim } from '../../app/utility/interfaces'
import { monoFontFamily } from '../../theme'

export const STATUS_PHASES = [
  { label: 'Pending', statuses: ['pending'], color: 'default' as const, icon: <HourglassEmptyIcon fontSize="small" /> },
  { label: 'In Progress', statuses: ['in_progress', 'printing'], color: 'info' as const, icon: <BuildIcon fontSize="small" /> },
  { label: 'QA / Ready', statuses: ['qa_check'], color: 'warning' as const, icon: <PrintIcon fontSize="small" /> },
  { label: 'Shipping', statuses: ['shipped', 'delivered'], color: 'primary' as const, icon: <LocalShippingIcon fontSize="small" /> },
  { label: 'Complete', statuses: ['accepted'], color: 'success' as const, icon: <CheckCircleIcon fontSize="small" /> },
  { label: 'Disputed', statuses: ['disputed', 'resolved_accepted', 'resolved_partial', 'resolved_rejected'], color: 'error' as const, icon: <GavelIcon fontSize="small" /> },
  { label: 'Cancelled', statuses: ['cancelled'], color: 'default' as const, icon: <CancelIcon fontSize="small" /> },
]

const COMPLETED_STATUSES = ['accepted', 'resolved_accepted', 'resolved_partial', 'resolved_rejected']

interface ClaimDashboardHeaderProps {
  claims: Claim[]
  onPhaseClick: (statuses: string[]) => void
}

export function ClaimDashboardHeader({ claims, onPhaseClick }: ClaimDashboardHeaderProps) {
  const totalClaims = claims.length
  const completedCount = claims.filter((c) => COMPLETED_STATUSES.includes(c.status)).length
  const progressPercent = totalClaims > 0 ? (completedCount / totalClaims) * 100 : 0

  const phaseCounts = STATUS_PHASES.map((phase) => ({
    ...phase,
    count: claims.filter((c) => phase.statuses.includes(c.status)).length,
  }))

  const totalEarnings = claims
    .filter((c) => c.status === 'accepted')
    .reduce((sum, c) => {
      const pricePerUnit = c.order.quantity > 0 ? c.order.price / c.order.quantity : 0
      return sum + pricePerUnit * c.quantity
    }, 0)

  return (
    <Box sx={{ p: 2.5, pb: 1.5 }}>
      {/* Progress bar */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Overall Progress
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {completedCount}/{totalClaims} completed
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progressPercent}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>

      {/* Status phase chips + earnings */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        {phaseCounts
          .filter((p) => p.count > 0)
          .map((phase) => (
            <Chip
              key={phase.label}
              icon={phase.icon}
              label={`${phase.label}: ${phase.count}`}
              color={phase.color}
              size="small"
              variant="outlined"
              onClick={() => onPhaseClick(phase.statuses)}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        {totalEarnings > 0 && (
          <Box sx={{ ml: 'auto' }}>
            <Typography
              variant="body2"
              sx={{ color: '#00E5FF', fontFamily: monoFontFamily, fontWeight: 600 }}
            >
              Earned: ${totalEarnings.toFixed(2)}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}
