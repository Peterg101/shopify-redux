import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Chip,
  CircularProgress,
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'

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

const getTransitionDescription = (
  selectedStatus: string,
  currentStatus: string,
  isCancelAction: boolean
) => {
  if (isCancelAction) {
    return 'This claim will be cancelled. The claimed items will be returned to the marketplace for other fulfillers.'
  }
  if (selectedStatus === 'shipped') {
    return 'A shipping label will be automatically created and the buyer will be notified.'
  }
  if (selectedStatus === 'qa_check') {
    return 'The order will enter quality assurance inspection before shipping.'
  }
  if (selectedStatus === 'printing') {
    return 'Marks the order as actively being printed or manufactured.'
  }
  if (selectedStatus === 'in_progress') {
    return 'You are accepting this claim and beginning fulfillment.'
  }
  if (selectedStatus === 'delivered') {
    return 'Confirms the package has been delivered. The buyer will be prompted to review.'
  }
  const fromPhase = getPhase(currentStatus)
  const toPhase = getPhase(selectedStatus)
  return `Moving claim from ${fromPhase?.label || currentStatus} to ${toPhase?.label || selectedStatus}.`
}

interface StatusTransitionDialogProps {
  open: boolean
  currentStatus: string
  selectedStatus: string
  qaLevel: string
  isUpdating: boolean
  isCancelAction: boolean
  onClose: () => void
  onConfirm: () => void
}

export const StatusTransitionDialog = ({
  open,
  currentStatus,
  selectedStatus,
  qaLevel,
  isUpdating,
  isCancelAction,
  onClose,
  onConfirm,
}: StatusTransitionDialogProps) => {
  const fromPhase = getPhase(currentStatus)
  const toPhase = getPhase(selectedStatus)

  return (
    <Dialog
      open={open}
      onClose={() => !isUpdating && onClose()}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          ...(isCancelAction && { color: '#FF5252' }),
        }}
      >
        {isCancelAction && <WarningAmberIcon sx={{ color: '#FF5252' }} />}
        {isCancelAction ? 'Cancel Claim?' : 'Confirm Status Change'}
      </DialogTitle>
      <DialogContent>
        {/* From -> To chips */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            mb: 2.5,
            flexWrap: 'wrap',
          }}
        >
          <Chip
            label={fromPhase?.label || currentStatus}
            size="small"
            sx={{
              backgroundColor: `${fromPhase?.color || '#8899AA'}20`,
              color: fromPhase?.color || '#8899AA',
              fontWeight: 600,
              border: `1px solid ${fromPhase?.color || '#8899AA'}40`,
            }}
          />
          <Typography variant="body2" color="text.secondary">
            -&gt;
          </Typography>
          <Chip
            label={toPhase?.label || selectedStatus}
            size="small"
            sx={{
              backgroundColor: `${toPhase?.color || '#8899AA'}20`,
              color: toPhase?.color || '#FF5252',
              fontWeight: 600,
              border: `1px solid ${toPhase?.color || '#FF5252'}40`,
            }}
          />
        </Box>

        {/* Description */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {getTransitionDescription(selectedStatus, currentStatus, isCancelAction)}
        </Typography>

        {/* High QA warning */}
        {qaLevel === 'high' &&
          !isCancelAction &&
          (selectedStatus === 'shipped' || selectedStatus === 'qa_check') && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                p: 1.5,
                borderRadius: 1.5,
                backgroundColor: 'rgba(255, 145, 0, 0.08)',
                border: '1px solid rgba(255, 145, 0, 0.2)',
                mb: 1,
              }}
            >
              <WarningAmberIcon
                sx={{ color: '#FF9100', fontSize: 20, mt: 0.25 }}
              />
              <Typography variant="caption" color="#FF9100">
                This is a <strong>high-QA</strong> order. Evidence photos are
                required and will be reviewed by the buyer.
              </Typography>
            </Box>
          )}

        {/* Cancel warning */}
        {isCancelAction && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
              p: 1.5,
              borderRadius: 1.5,
              backgroundColor: 'rgba(255, 82, 82, 0.08)',
              border: '1px solid rgba(255, 82, 82, 0.2)',
            }}
          >
            <WarningAmberIcon
              sx={{ color: '#FF5252', fontSize: 20, mt: 0.25 }}
            />
            <Typography variant="caption" color="#FF5252">
              Items will be returned to the marketplace and made available
              for other fulfillers to claim.
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          onClick={onClose}
          disabled={isUpdating}
          sx={{ fontWeight: 600 }}
        >
          Go Back
        </Button>
        <Button
          variant="contained"
          color={isCancelAction ? 'error' : 'primary'}
          onClick={onConfirm}
          disabled={isUpdating}
          sx={{ fontWeight: 600, minWidth: 100 }}
        >
          {isUpdating ? (
            <CircularProgress size={20} sx={{ color: 'inherit' }} />
          ) : (
            'Confirm'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
