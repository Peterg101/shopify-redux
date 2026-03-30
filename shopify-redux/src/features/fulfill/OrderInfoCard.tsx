import { Paper, Box, Typography, Divider, Chip } from '@mui/material'
import { Order, Claim } from '../../app/utility/interfaces'
import { borderSubtle } from '../../theme'

const STATUS_PHASES = [
  { key: 'pending',      label: 'Pending',      color: '#8899AA' },
  { key: 'in_progress',  label: 'In Progress',  color: '#00E5FF' },
  { key: 'printing',     label: 'Printing',     color: '#76FF03' },
  { key: 'qa_check',     label: 'QA Check',     color: '#FF9100' },
  { key: 'shipped',      label: 'Shipped',      color: '#448AFF' },
  { key: 'delivered',    label: 'Delivered',     color: '#B388FF' },
  { key: 'accepted',     label: 'Accepted',     color: '#69F0AE' },
  { key: 'disputed',     label: 'Disputed',     color: '#FF5252' },
  { key: 'cancelled',    label: 'Cancelled',    color: '#FF5252' },
] as const

const getPhase = (key: string) => STATUS_PHASES.find((p) => p.key === key)

interface OrderInfoCardProps {
  order: Order
  claim: Claim
  currentStatus: string
}

export const OrderInfoCard = ({ order, claim, currentStatus }: OrderInfoCardProps) => {
  const fromPhase = getPhase(currentStatus)
  const qaLevel = order.qa_level || 'standard'

  return (
    <Paper elevation={2} sx={{ flex: 1, p: 3, borderRadius: 3 }}>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Order Information
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="body1">
          <strong>Name:</strong> {order.name}
        </Typography>
        <Typography variant="body1">
          <strong>Material:</strong> {order.material}
        </Typography>
        <Typography variant="body1">
          <strong>Technique:</strong> {order.technique}
        </Typography>
        <Typography variant="body1">
          <strong>Colour:</strong> {order.colour}
        </Typography>

        {/* Quantity as chip */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body1">
            <strong>Quantity:</strong>
          </Typography>
          <Chip
            label={`${claim.quantity} units`}
            size="small"
            sx={{
              backgroundColor: borderSubtle,
              color: '#00E5FF',
              fontWeight: 600,
            }}
          />
        </Box>

        {/* Current status as colored chip */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body1">
            <strong>Status:</strong>
          </Typography>
          <Chip
            label={fromPhase?.label || currentStatus.replace(/_/g, ' ')}
            size="small"
            sx={{
              backgroundColor: `${fromPhase?.color || '#8899AA'}20`,
              color: fromPhase?.color || '#8899AA',
              fontWeight: 600,
              border: `1px solid ${fromPhase?.color || '#8899AA'}40`,
            }}
          />
        </Box>

        {/* QA level as colored chip */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body1">
            <strong>QA Level:</strong>
          </Typography>
          <Chip
            label={qaLevel.charAt(0).toUpperCase() + qaLevel.slice(1)}
            size="small"
            sx={{
              backgroundColor:
                qaLevel === 'high'
                  ? 'rgba(255, 145, 0, 0.15)'
                  : 'rgba(136, 153, 170, 0.15)',
              color: qaLevel === 'high' ? '#FF9100' : '#8899AA',
              fontWeight: 600,
              border: `1px solid ${qaLevel === 'high' ? '#FF910040' : '#8899AA30'}`,
            }}
          />
        </Box>
      </Box>
    </Paper>
  )
}
