import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../app/store'
import { setSelectedClaim, setUpdateClaimMode } from '../../services/userInterfaceSlice'
import { resetDataState } from '../../services/dataSlice'
import { createShippingLabel } from '../../services/fetchFileUtils'
import { useUpdateClaimStatusMutation, useUploadClaimEvidenceMutation } from '../../services/dbApi'
import { useState, useCallback, useMemo, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Box,
  Typography,
  Paper,
  Divider,
  Grid,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Snackbar,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CancelIcon from '@mui/icons-material/Cancel'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import DownloadIcon from '@mui/icons-material/Download'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import OBJSTLViewer from '../display/objStlViewer'
import { OrientationControls } from '../display/OrientationControls'
import { BuyerReviewPanel } from './BuyerReviewPanel'
import { DisputePanel } from './DisputePanel'

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

const getPhase = (key: string) => STATUS_PHASES.find((p) => p.key === key)

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['in_progress'],
  in_progress: ['printing'],
  printing: ['qa_check'],
  qa_check: ['shipped'],
  shipped: ['delivered'],
  delivered: ['accepted', 'disputed'],
}

// Statuses that allow cancellation
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
  const { selectedClaim, userInformation } = useSelector(
    (state: RootState) => state.userInterfaceState
  )
  const dispatch = useDispatch()
  const [updateStatus] = useUpdateClaimStatusMutation()
  const [uploadEvidence] = useUploadClaimEvidenceMutation()

  const currentStatus = selectedClaim?.status ?? 'pending'
  const validNextStatuses = ALLOWED_TRANSITIONS[currentStatus] ?? []
  const canCancel = CANCELLABLE_STATUSES.includes(currentStatus)

  const [selectedStatus, setSelectedStatus] = useState(validNextStatuses[0] ?? '')
  const [isUpdating, setIsUpdating] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Reset selectedStatus when the claim changes so the dropdown doesn't show a stale value
  useEffect(() => {
    setSelectedStatus(validNextStatuses[0] ?? '')
  }, [selectedClaim?.id])

  // Evidence upload state
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null)
  const [evidenceDescription, setEvidenceDescription] = useState('')
  const [fileError, setFileError] = useState('')

  // Shipping label state
  const [labelResult, setLabelResult] = useState<{
    label_url: string
    tracking_number: string
    carrier_code: string
  } | null>(null)
  const [labelError, setLabelError] = useState('')

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

  // ── Dropzone ──────────────────────────────────────────────────────
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setFileError('')
      if (acceptedFiles.length === 0) return

      const file = acceptedFiles[0]
      if (file.size > 5 * 1024 * 1024) {
        setFileError('File too large -- maximum 5 MB')
        return
      }
      if (!file.type.startsWith('image/')) {
        setFileError('Only image files are accepted')
        return
      }
      setEvidenceFile(file)
      const url = URL.createObjectURL(file)
      setEvidencePreview(url)
    },
    []
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
    multiple: false,
  })

  const clearEvidence = () => {
    setEvidenceFile(null)
    if (evidencePreview) URL.revokeObjectURL(evidencePreview)
    setEvidencePreview(null)
    setEvidenceDescription('')
    setFileError('')
  }

  // ── Confirmation dialog helpers ───────────────────────────────────
  const isCancelAction = selectedStatus === 'cancelled'
  const fromPhase = getPhase(currentStatus)
  const toPhase = getPhase(selectedStatus)

  const getTransitionDescription = () => {
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
    return `Moving claim from ${fromPhase?.label || currentStatus} to ${toPhase?.label || selectedStatus}.`
  }

  const handleConfirmClick = () => {
    if (!selectedClaim || !selectedStatus) return
    if (
      currentStatus === 'qa_check' &&
      selectedClaim.order.qa_level === 'high' &&
      !evidenceFile
    ) {
      setSnackbar({
        open: true,
        message: 'Evidence photo required for high-QA orders before shipping',
        severity: 'error',
      })
      return
    }
    setConfirmOpen(true)
  }

  const handleDialogConfirm = async () => {
    if (!selectedClaim || !selectedStatus) return
    setIsUpdating(true)
    setConfirmOpen(false)

    try {
      // Upload evidence before status patch if file selected
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
  }

  const handleCancel = () => {
    dispatch(setSelectedClaim({ selectedClaim: null }))
    dispatch(resetDataState())
    dispatch(setUpdateClaimMode({ updateClaimMode: false }))
  }

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
          {/* ── 3a. MiniStepper ────────────────────────────────── */}
          <Paper
            elevation={1}
            sx={{
              p: 2,
              borderRadius: 3,
              border: '1px solid rgba(0, 229, 255, 0.12)',
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

          {/* ── 3f. Order Info Panel ───────────────────────────── */}
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
                  label={`${selectedClaim.quantity} units`}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(0, 229, 255, 0.12)',
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

          {/* ── 3e. Shipping Label Display ─────────────────────── */}
          {shippingLabel && (
            <Paper
              elevation={2}
              sx={{
                p: 2.5,
                borderRadius: 3,
                border: '1px solid rgba(68, 138, 255, 0.25)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <LocalShippingIcon sx={{ color: '#448AFF', fontSize: 24 }} />
                <Typography variant="h6" fontWeight={600}>
                  Shipping Label
                </Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Carrier
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={shippingLabel.carrier_code}
                      size="small"
                      sx={{
                        backgroundColor: 'rgba(68, 138, 255, 0.12)',
                        color: '#448AFF',
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Tracking Number
                  </Typography>
                  <Box
                    sx={{
                      mt: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: 'monospace', fontWeight: 600 }}
                    >
                      {shippingLabel.tracking_number}
                    </Typography>
                    <Tooltip title="Copy tracking number">
                      <IconButton
                        size="small"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            shippingLabel.tracking_number
                          )
                          setSnackbar({
                            open: true,
                            message: 'Tracking number copied',
                            severity: 'success',
                          })
                        }}
                        sx={{ color: 'text.secondary' }}
                      >
                        <ContentCopyIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<DownloadIcon />}
                    href={shippingLabel.label_url}
                    target="_blank"
                    sx={{
                      mt: 1,
                      py: 1.2,
                      fontWeight: 600,
                      backgroundColor: '#448AFF',
                      '&:hover': {
                        backgroundColor: '#2979FF',
                        boxShadow: '0 0 16px rgba(68, 138, 255, 0.4)',
                      },
                    }}
                  >
                    Download PDF Label
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          )}

        </Grid>

        {/* ── Bottom Row: Orientation Controls + Update Status ── */}
        <Grid item xs={12} md={7}>
          <Paper
            elevation={2}
            sx={{
              borderRadius: 3,
              overflow: 'hidden',
              border: '1px solid rgba(0, 229, 255, 0.12)',
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

            {/* ── 3d. Drag-and-drop evidence upload ────────────── */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {currentStatus === 'qa_check' && qaLevel === 'high'
                  ? 'Upload QA evidence photo (required for high-QA orders)'
                  : 'Upload photo evidence (optional)'}
              </Typography>

              {!evidenceFile ? (
                <Box
                  {...getRootProps()}
                  sx={{
                    border: '2px dashed',
                    borderColor: isDragActive
                      ? 'primary.main'
                      : fileError
                        ? 'error.main'
                        : 'rgba(0, 229, 255, 0.25)',
                    borderRadius: 2,
                    py: 3,
                    px: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    backgroundColor: isDragActive
                      ? 'rgba(0, 229, 255, 0.06)'
                      : 'transparent',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: 'rgba(0, 229, 255, 0.04)',
                      boxShadow: '0 0 20px rgba(0, 229, 255, 0.08)',
                    },
                  }}
                >
                  <input {...getInputProps()} />
                  <CloudUploadIcon
                    sx={{ fontSize: 36, color: 'primary.main', mb: 1, opacity: 0.7 }}
                  />
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    textAlign="center"
                  >
                    Drag photo here or click to browse
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 0.5, opacity: 0.5 }}
                  >
                    Max 5 MB, images only
                  </Typography>
                </Box>
              ) : (
                <Box
                  sx={{
                    border: '1px solid rgba(0, 229, 255, 0.2)',
                    borderRadius: 2,
                    p: 2,
                    position: 'relative',
                  }}
                >
                  {evidencePreview && (
                    <Box
                      sx={{
                        mb: 1.5,
                        borderRadius: 1,
                        overflow: 'hidden',
                        maxHeight: 160,
                        display: 'flex',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0,0,0,0.2)',
                      }}
                    >
                      <img
                        src={evidencePreview}
                        alt="Evidence preview"
                        style={{
                          maxWidth: '100%',
                          maxHeight: 160,
                          objectFit: 'contain',
                        }}
                      />
                    </Box>
                  )}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '70%',
                      }}
                    >
                      {evidenceFile.name}
                    </Typography>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteOutlineIcon sx={{ fontSize: 16 }} />}
                      onClick={clearEvidence}
                      sx={{ textTransform: 'none', minWidth: 'auto' }}
                    >
                      Remove
                    </Button>
                  </Box>
                  <TextField
                    label="Evidence Description"
                    value={evidenceDescription}
                    onChange={(e) => setEvidenceDescription(e.target.value)}
                    fullWidth
                    size="small"
                    sx={{ mt: 1.5 }}
                  />
                </Box>
              )}

              {fileError && (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ mt: 0.5, display: 'block' }}
                >
                  {fileError}
                </Typography>
              )}
            </Box>

            {/* ── 3b. Rich status dropdown ─────────────────────── */}
            {dropdownOptions.length > 0 ? (
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>New Status</InputLabel>
                <Select
                  value={selectedStatus}
                  label="New Status"
                  onChange={(e) => setSelectedStatus(e.target.value)}
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
                  {dropdownOptions.map(({ key, isCancel }) => {
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
            ) : (
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                No further status transitions available.
              </Typography>
            )}

            {labelError && (
              <Typography color="error" variant="body2" sx={{ mb: 2 }}>
                {labelError}
              </Typography>
            )}

            {/* ── 3g. Action Buttons with loading state ────────── */}
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

      {/* ── 3c / 3h. Confirmation Dialog ─────────────────────────── */}
      <Dialog
        open={confirmOpen}
        onClose={() => !isUpdating && setConfirmOpen(false)}
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
            {getTransitionDescription()}
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
            onClick={() => setConfirmOpen(false)}
            disabled={isUpdating}
            sx={{ fontWeight: 600 }}
          >
            Go Back
          </Button>
          <Button
            variant="contained"
            color={isCancelAction ? 'error' : 'primary'}
            onClick={handleDialogConfirm}
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
    </Box>
  )
}
