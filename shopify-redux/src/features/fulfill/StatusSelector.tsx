import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Chip,
} from '@mui/material'
import CancelIcon from '@mui/icons-material/Cancel'

const STATUS_PHASES = [
  { key: 'pending',      label: 'Pending',      color: '#8899AA', description: 'Claim submitted, awaiting fulfiller action' },
  { key: 'in_progress',  label: 'In Progress',  color: '#00E5FF', description: 'Fulfiller is preparing the order' },
  { key: 'printing',     label: 'Printing',     color: '#76FF03', description: 'Item is being printed / manufactured' },
  { key: 'qa_check',     label: 'QA Check',     color: '#FF9100', description: 'Quality assurance inspection' },
  { key: 'shipped',      label: 'Shipped',      color: '#448AFF', description: 'Package shipped to buyer' },
  { key: 'delivered',    label: 'Delivered',     color: '#B388FF', description: 'Package delivered, awaiting buyer review' },
  { key: 'accepted',     label: 'Accepted',     color: '#69F0AE', description: 'Buyer accepted the delivery' },
  { key: 'disputed',     label: 'Disputed',     color: '#FF5252', description: 'Buyer opened a dispute' },
  { key: 'cancelled',    label: 'Cancelled',    color: '#FF5252', description: 'Claim cancelled, items returned to marketplace' },
] as const

const getPhase = (key: string) => STATUS_PHASES.find((p) => p.key === key)

interface StatusSelectorProps {
  options: Array<{ key: string; isCancel: boolean }>
  selectedStatus: string
  isUpdating: boolean
  onChange: (status: string) => void
}

export const StatusSelector = ({
  options,
  selectedStatus,
  isUpdating,
  onChange,
}: StatusSelectorProps) => {
  if (options.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        No further status transitions available.
      </Typography>
    )
  }

  return (
    <FormControl fullWidth sx={{ mb: 3 }}>
      <InputLabel>New Status</InputLabel>
      <Select
        value={selectedStatus}
        label="New Status"
        onChange={(e) => onChange(e.target.value)}
        disabled={isUpdating}
        renderValue={(value) => {
          const phase = getPhase(value)
          if (!phase) return value
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: phase.color,
                  flexShrink: 0,
                }}
              />
              <Typography variant="body2">{phase.label}</Typography>
            </Box>
          )
        }}
      >
        {options.map(({ key, isCancel }) => {
          const phase = getPhase(key)
          return (
            <MenuItem
              key={key}
              value={key}
              sx={{
                py: 1.5,
                ...(isCancel && {
                  borderTop: '1px solid rgba(255, 82, 82, 0.2)',
                  mt: 0.5,
                }),
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.5,
                  width: '100%',
                }}
              >
                {isCancel ? (
                  <CancelIcon
                    sx={{ color: '#FF5252', fontSize: 20, mt: 0.25 }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: phase?.color || '#8899AA',
                      mt: 0.5,
                      flexShrink: 0,
                    }}
                  />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{
                        color: isCancel ? '#FF5252' : 'text.primary',
                      }}
                    >
                      {isCancel ? 'Cancel Claim' : phase?.label}
                    </Typography>
                    <Chip
                      label={key}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.65rem',
                        backgroundColor: `${phase?.color || '#FF5252'}15`,
                        color: phase?.color || '#FF5252',
                        border: `1px solid ${phase?.color || '#FF5252'}30`,
                      }}
                    />
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.25 }}
                  >
                    {phase?.description}
                  </Typography>
                </Box>
              </Box>
            </MenuItem>
          )
        })}
      </Select>
    </FormControl>
  )
}
