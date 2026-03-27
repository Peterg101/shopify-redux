import { useDispatch } from 'react-redux'
import {
  Box,
  Typography,
  Chip,
  Card,
  CardContent,
  CardActionArea,
  Divider,
  LinearProgress,
} from '@mui/material'
import PrintIcon from '@mui/icons-material/Print'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import BuildIcon from '@mui/icons-material/Build'
import GavelIcon from '@mui/icons-material/Gavel'
import { Claim } from '../../app/utility/interfaces'
import { setSelectedClaim, setUpdateClaimMode } from '../../services/userInterfaceSlice'
import { useOrderFileLoader } from '../../hooks/useOrderFileLoader'
import { useGetUserClaimsQuery } from '../../services/authApi'
import { FulfillerAddressForm } from './FulfillerAddressForm'

const STATUS_PHASES = [
  {
    label: 'Pending',
    statuses: ['pending'],
    color: 'default' as const,
    icon: <HourglassEmptyIcon fontSize="small" />,
  },
  {
    label: 'In Progress',
    statuses: ['in_progress', 'printing'],
    color: 'info' as const,
    icon: <BuildIcon fontSize="small" />,
  },
  {
    label: 'QA / Ready',
    statuses: ['qa_check'],
    color: 'warning' as const,
    icon: <PrintIcon fontSize="small" />,
  },
  {
    label: 'Shipping',
    statuses: ['shipped', 'delivered'],
    color: 'primary' as const,
    icon: <LocalShippingIcon fontSize="small" />,
  },
  {
    label: 'Complete',
    statuses: ['accepted'],
    color: 'success' as const,
    icon: <CheckCircleIcon fontSize="small" />,
  },
  {
    label: 'Disputed',
    statuses: ['disputed', 'resolved_accepted', 'resolved_partial', 'resolved_rejected'],
    color: 'error' as const,
    icon: <GavelIcon fontSize="small" />,
  },
]

const statusLabel = (status: string) => status.replace(/_/g, ' ')

export const ClaimedOrdersPanel = () => {
  const dispatch = useDispatch()
  const { prepareOrderFile } = useOrderFileLoader()
  const { data: claims = [] } = useGetUserClaimsQuery()

  const handleOpenClaim = async (claim: Claim) => {
    await prepareOrderFile(claim.order)
    dispatch(setUpdateClaimMode({ updateClaimMode: true }))
    dispatch(setSelectedClaim({ selectedClaim: claim }))
  }

  // Count claims per phase
  const phaseCounts = STATUS_PHASES.map((phase) => ({
    ...phase,
    count: claims.filter((c) => phase.statuses.includes(c.status)).length,
  }))

  const totalClaims = claims.length
  const completedCount = claims.filter((c) =>
    ['accepted', 'resolved_accepted', 'resolved_partial', 'resolved_rejected'].includes(c.status)
  ).length
  const progressPercent = totalClaims > 0 ? (completedCount / totalClaims) * 100 : 0

  // Active claims (not complete/resolved)
  const activeClaims = claims.filter(
    (c) => !['accepted', 'resolved_accepted', 'resolved_partial', 'resolved_rejected'].includes(c.status)
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Overall progress */}
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Overall Progress
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {completedCount}/{totalClaims}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progressPercent}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>

      {/* Status breakdown */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
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
            />
          ))}
        {totalClaims === 0 && (
          <Typography variant="body2" color="text.secondary">
            No claims yet
          </Typography>
        )}
      </Box>

      {/* Active claims list */}
      {activeClaims.length > 0 && (
        <>
          <Divider />
          <Typography variant="subtitle2" fontWeight={600}>
            Active Claims
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {activeClaims.map((claim) => (
              <Card key={claim.id} variant="outlined" sx={{ borderRadius: 2 }}>
                <CardActionArea onClick={() => handleOpenClaim(claim)}>
                  <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {claim.order.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Qty: {claim.quantity} | {claim.order.material}
                        </Typography>
                      </Box>
                      <Chip
                        label={statusLabel(claim.status)}
                        size="small"
                        color={
                          ['pending'].includes(claim.status) ? 'default' :
                          ['in_progress', 'printing'].includes(claim.status) ? 'info' :
                          ['qa_check'].includes(claim.status) ? 'warning' :
                          ['shipped', 'delivered'].includes(claim.status) ? 'primary' :
                          ['disputed'].includes(claim.status) ? 'error' : 'success'
                        }
                        sx={{ ml: 1, textTransform: 'capitalize' }}
                      />
                    </Box>
                    {claim.tracking_number && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        Tracking: {claim.tracking_number}
                      </Typography>
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        </>
      )}

      {/* Fulfiller address */}
      <Divider />
      <FulfillerAddressForm />
    </Box>
  )
}
