import { useSelector } from 'react-redux'
import { useDispatch } from 'react-redux'
import { setSelectedClaim, setUpdateClaimMode } from '../../services/userInterfaceSlice'
import { resetDataState } from '../../services/dataSlice'
import { createShippingLabel } from '../../services/fetchFileUtils'
import { useUpdateClaimStatusMutation, useUploadClaimEvidenceMutation } from '../../services/dbApi'
import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import ChatIcon from '@mui/icons-material/Chat'
import { ClaimChat } from '../messaging/ClaimChat'
import {
  Box,
  Typography,
  Paper,
  Divider,
  Grid,
  Button,
  Snackbar,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material'
import OBJSTLViewer from '../display/objStlViewer'
import { OrientationControls } from '../display/OrientationControls'
import { BuyerReviewPanel } from './BuyerReviewPanel'
import { DisputePanel } from './DisputePanel'
import { EvidenceUploadSection } from './EvidenceUploadSection'
import { ShippingLabelCard } from './ShippingLabelCard'
import { OrderInfoCard } from './OrderInfoCard'
import { StatusSelector } from './StatusSelector'
import { StatusTransitionDialog } from './StatusTransitionDialog'
import { selectSelectedClaim, selectUserInformation } from '../../services/selectors'
import { borderSubtle } from '../../theme'

// ── Status phase definitions ──────────────────────────────────────────
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

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['in_progress'],
  in_progress: ['printing'],
  printing: ['qa_check'],
  qa_check: ['shipped'],
  shipped: ['delivered'],
  delivered: ['accepted', 'disputed'],
}

const CANCELLABLE_STATUSES = ['pending', 'in_progress']

// ── MiniStepper ───────────────────────────────────────────────────────
const STEPPER_PHASES = STATUS_PHASES.filter(
  (p) => !['accepted', 'disputed', 'cancelled'].includes(p.key)
)

const MiniStepper = ({ currentStatus }: { currentStatus: string }) => {
  const currentIdx = STEPPER_PHASES.findIndex((p) => p.key === currentStatus)
  const nextIdx = currentIdx + 1

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        py: 1.5,
        px: 1,
        overflowX: 'auto',
      }}
    >
      {STEPPER_PHASES.map((phase, idx) => {
        const isActive = idx === currentIdx
        const isPast = idx < currentIdx
        const isNext = idx === nextIdx
        const dotColor = isActive
          ? phase.color
          : isPast
            ? phase.color
            : 'rgba(136, 153, 170, 0.3)'

        return (
          <Box key={phase.key} sx={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title={phase.label} arrow>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: dotColor,
                  opacity: isPast ? 0.5 : 1,
                  transition: 'all 0.3s ease',
                  boxShadow: isActive ? `0 0 8px ${phase.color}` : 'none',
                  position: 'relative',
                }}
              >
                {isNext && (
                  <Typography
                    sx={{
                      position: 'absolute',
                      top: -18,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: '10px',
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    next
                  </Typography>
                )}
              </Box>
            </Tooltip>
            {idx < STEPPER_PHASES.length - 1 && (
              <Box
                sx={{
                  width: 20,
                  height: 2,
                  backgroundColor: isPast ? phase.color : 'rgba(136, 153, 170, 0.15)',
                  opacity: isPast ? 0.5 : 1,
                  mx: 0.25,
                }}
              />
            )}
          </Box>
        )
      })}
    </Box>
  )
}

// ── Main Component ────────────────────────────────────────────────────
export const UpdateClaimStatus = () => {
  const selectedClaim = useSelector(selectSelectedClaim)
  const userInformation = useSelector(selectUserInformation)
  const dispatch = useDispatch()
  const [updateStatus] = useUpdateClaimStatusMutation()
  const [uploadEvidence] = useUploadClaimEvidenceMutation()

  const currentStatus = selectedClaim?.status ?? 'pending'
  const validNextStatuses = useMemo(
    () => ALLOWED_TRANSITIONS[currentStatus] ?? [],
    [currentStatus]
  )
  const canCancel = CANCELLABLE_STATUSES.includes(currentStatus)

  const [selectedStatus, setSelectedStatus] = useState(validNextStatuses[0] ?? '')
  const [isUpdating, setIsUpdating] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Track evidence from child component
  const evidenceRef = useRef<{ file: File | null; description: string }>({
    file: null,
    description: '',
  })

  const handleEvidenceChange = useCallback((file: File | null, description: string) => {
    evidenceRef.current = { file, description }
  }, [])

  // Reset selectedStatus when the claim changes
  useEffect(() => {
    setSelectedStatus(validNextStatuses[0] ?? '')
  }, [selectedClaim?.id, validNextStatuses])

  // Shipping label state
  const [labelResult, setLabelResult] = useState<{
    label_url: string
    tracking_number: string
    carrier_code: string
  } | null>(null)
  const [labelError, setLabelError] = useState('')

  const [chatOpen, setChatOpen] = useState(false)
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'error' as 'error' | 'warning' | 'success',
  })

  // Use existing claim data for shipping label if available
  const existingLabel = useMemo(() => {
    if (!selectedClaim) return null
    if (selectedClaim.tracking_number && selectedClaim.label_url) {
      return {
        label_url: selectedClaim.label_url,
        tracking_number: selectedClaim.tracking_number,
        carrier_code: selectedClaim.carrier_code || 'Unknown',
      }
    }
    return null
  }, [selectedClaim])

  const shippingLabel = labelResult || existingLabel

  // ── Confirmation dialog helpers ───────────────────────────────────
  const isCancelAction = selectedStatus === 'cancelled'

  const handleConfirmClick = useCallback(() => {
    if (!selectedClaim || !selectedStatus) return
    if (
      currentStatus === 'qa_check' &&
      selectedClaim.order.qa_level === 'high' &&
      !evidenceRef.current.file
    ) {
      setSnackbar({
        open: true,
        message: 'Evidence photo required for high-QA orders before shipping',
        severity: 'error',
      })
      return
    }
    setConfirmOpen(true)
  }, [selectedClaim, selectedStatus, currentStatus])

  const handleDialogConfirm = useCallback(async () => {
    if (!selectedClaim || !selectedStatus) return
    setIsUpdating(true)
    setConfirmOpen(false)

    try {
      // Upload evidence before status patch if file selected
      const { file: evidenceFile, description: evidenceDescription } = evidenceRef.current
      if (evidenceFile) {
        const reader = new FileReader()
        await new Promise<void>((resolve) => {
          reader.onload = async () => {
            const base64 = (reader.result as string).split(',')[1]
            await uploadEvidence({
              claimId: selectedClaim.id,
              imageData: base64,
              description: evidenceDescription || undefined,
            }).unwrap()
            resolve()
          }
          reader.readAsDataURL(evidenceFile)
        })
      }

      // Auto-create shipping label when moving to "shipped"
      if (selectedStatus === 'shipped') {
        setLabelError('')
        try {
          const result = await createShippingLabel(selectedClaim.id)
          setLabelResult(result)
        } catch (err: any) {
          setLabelError(
            err.message ||
              'Failed to create shipping label. You can create it manually later.'
          )
        }
      }

      await updateStatus({
        claimId: selectedClaim.id,
        status: selectedStatus,
      }).unwrap()
      dispatch(setSelectedClaim({ selectedClaim: null }))
      dispatch(setUpdateClaimMode({ updateClaimMode: false }))
      dispatch(resetDataState())
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.message || 'Failed to update claim status',
        severity: 'error',
      })
    } finally {
      setIsUpdating(false)
    }
  }, [selectedClaim, selectedStatus, updateStatus, uploadEvidence, dispatch])

  const handleCancel = useCallback(() => {
    dispatch(setSelectedClaim({ selectedClaim: null }))
    dispatch(resetDataState())
    dispatch(setUpdateClaimMode({ updateClaimMode: false }))
  }, [dispatch])

  const handleCopySuccess = useCallback(() => {
    setSnackbar({
      open: true,
      message: 'Tracking number copied',
      severity: 'success',
    })
  }, [])

  if (!selectedClaim) return null
  const order = selectedClaim.order

  // If claim is delivered and current user is the buyer, show buyer review panel
  const isBuyer = userInformation?.user?.user_id === order.user_id
  if (currentStatus === 'delivered' && isBuyer) {
    return <BuyerReviewPanel claim={selectedClaim} onClose={handleCancel} />
  }

  // If claim is disputed or resolved, show dispute panel
  if (currentStatus === 'disputed' || currentStatus.startsWith('resolved_')) {
    return <DisputePanel claim={selectedClaim} onClose={handleCancel} />
  }

  // All dropdown options: valid transitions + cancel if allowed
  const dropdownOptions = [
    ...validNextStatuses.map((s) => ({ key: s, isCancel: false })),
    ...(canCancel ? [{ key: 'cancelled', isCancel: true }] : []),
  ]

  const qaLevel = order.qa_level || 'standard'

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'background.default',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        py: 10,
        px: 3,
      }}
    >
      <Grid
        container
        spacing={4}
        sx={{ maxWidth: 1200, width: '100%' }}
      >
        {/* ── 3D Viewer ──────────────────────────────────────────── */}
        <Grid item xs={12} md={7}>
          <Paper
            elevation={4}
            sx={{
              borderRadius: 3,
              overflow: 'hidden',
              minHeight: 600,
              height: 650,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <OBJSTLViewer hideOrientationControls />
          </Paper>
        </Grid>

        {/* ── Right Panel ────────────────────────────────────────── */}
        <Grid
          item
          xs={12}
          md={5}
          sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
        >
          {/* ── MiniStepper ────────────────────────────────────── */}
          <Paper
            elevation={1}
            sx={{
              p: 2,
              borderRadius: 3,
              border: `1px solid ${borderSubtle}`,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', textAlign: 'center', mb: 0.5 }}
            >
              Claim Progress
            </Typography>
            <MiniStepper currentStatus={currentStatus} />
          </Paper>

          {/* ── Order Info Panel ─────────────────────────────────── */}
          <OrderInfoCard
            order={order}
            claim={selectedClaim}
            currentStatus={currentStatus}
          />

          {/* ── Chat with Buyer ──────────────────────────────────── */}
          <Button
            variant="outlined"
            startIcon={<ChatIcon />}
            onClick={() => setChatOpen(true)}
            fullWidth
            sx={{ borderRadius: 2 }}
          >
            Message Buyer
          </Button>

          {/* ── Shipping Label Display ───────────────────────────── */}
          {shippingLabel && (
            <ShippingLabelCard
              label={shippingLabel}
              onCopySuccess={handleCopySuccess}
            />
          )}

        </Grid>

        {/* ── Bottom Row: Orientation Controls + Update Status ── */}
        <Grid item xs={12} md={7}>
          <Paper
            elevation={2}
            sx={{
              borderRadius: 3,
              overflow: 'hidden',
              border: `1px solid ${borderSubtle}`,
            }}
          >
            <OrientationControls />
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          {/* ── Update Status Panel ────────────────────────────── */}
          <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
            <Typography variant="h5" fontWeight={600} gutterBottom>
              Update Status
            </Typography>
            <Divider sx={{ mb: 3 }} />

            {/* ── Evidence upload ─────────────────────────────────── */}
            <EvidenceUploadSection
              qaLevel={qaLevel}
              currentStatus={currentStatus}
              onEvidenceChange={handleEvidenceChange}
            />

            {/* ── Status dropdown ─────────────────────────────────── */}
            <StatusSelector
              options={dropdownOptions}
              selectedStatus={selectedStatus}
              isUpdating={isUpdating}
              onChange={setSelectedStatus}
            />

            {labelError && (
              <Typography color="error" variant="body2" sx={{ mb: 2 }}>
                {labelError}
              </Typography>
            )}

            {/* ── Action Buttons ──────────────────────────────────── */}
            <Box display="flex" gap={2}>
              <Button
                variant="contained"
                color={isCancelAction ? 'error' : 'primary'}
                size="large"
                fullWidth
                disabled={
                  !selectedStatus ||
                  dropdownOptions.length === 0 ||
                  isUpdating
                }
                onClick={handleConfirmClick}
                sx={{ py: 1.4, borderRadius: 2, fontWeight: 600 }}
              >
                {isUpdating ? (
                  <CircularProgress size={24} sx={{ color: 'inherit' }} />
                ) : isCancelAction ? (
                  'Cancel Claim'
                ) : (
                  'Confirm'
                )}
              </Button>
              <Button
                variant="outlined"
                size="large"
                fullWidth
                onClick={handleCancel}
                disabled={isUpdating}
                sx={{ py: 1.4, borderRadius: 2, fontWeight: 600 }}
              >
                Back
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* ── Confirmation Dialog ─────────────────────────────────── */}
      <StatusTransitionDialog
        open={confirmOpen}
        currentStatus={currentStatus}
        selectedStatus={selectedStatus}
        qaLevel={qaLevel}
        isUpdating={isUpdating}
        isCancelAction={isCancelAction}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDialogConfirm}
      />

      {/* ── Snackbar ─────────────────────────────────────────────── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {selectedClaim && (
        <ClaimChat claimId={selectedClaim.id} open={chatOpen} onClose={() => setChatOpen(false)} />
      )}
    </Box>
  )
}
