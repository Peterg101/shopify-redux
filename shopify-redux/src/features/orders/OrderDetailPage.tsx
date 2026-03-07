import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import {
  useGetOrderDetailQuery,
  useToggleOrderVisibilityMutation,
  useUpdateClaimStatusMutation,
  useRespondToDisputeMutation,
  useResolveDisputeMutation,
  useUploadDisputeEvidenceMutation,
} from '../../services/dbApi'
import {
  Box,
  Typography,
  Paper,
  Divider,
  Grid,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  ImageList,
  ImageListItem,
  TextField,
  Collapse,
} from '@mui/material'
import {
  ArrowBack,
  Person,
  LocalShipping,
  CheckCircle,
  Gavel,
  Public,
  Lock,
} from '@mui/icons-material'
import { useTheme } from '@mui/material/styles'
import { RootState } from '../../app/store'
import { ClaimDetail, Dispute } from '../../app/utility/interfaces'
import { setLeftDrawerClosed, setSelectedComponent } from '../../services/userInterfaceSlice'
import { HeaderBar } from '../userInterface/headerBar'
import { UpdatedUserInterface } from '../userInterface/updatedUserInterface'
import { DRAWER_WIDTH } from '../userInterface/uiComponents'

const CLAIM_STEPS = [
  'pending',
  'in_progress',
  'printing',
  'qa_check',
  'shipped',
  'delivered',
  'accepted',
]

const STEP_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  printing: 'Printing',
  qa_check: 'QA Check',
  shipped: 'Shipped',
  delivered: 'Delivered',
  accepted: 'Accepted',
  disputed: 'Disputed',
  resolved_accepted: 'Resolved (Accepted)',
  resolved_partial: 'Resolved (Partial)',
  resolved_rejected: 'Resolved (Rejected)',
}

const STATUS_COLOR: Record<string, 'error' | 'warning' | 'success' | 'default' | 'info' | 'primary'> = {
  pending: 'default',
  in_progress: 'info',
  printing: 'info',
  qa_check: 'warning',
  shipped: 'primary',
  delivered: 'success',
  accepted: 'success',
  disputed: 'error',
  resolved_accepted: 'success',
  resolved_partial: 'warning',
  resolved_rejected: 'error',
}

export const OrderDetailPage = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const theme = useTheme()
  const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState)
  const { userInformation } = userInterfaceState
  const collapsedWidth = `calc(${theme.spacing(8)} + 1px)`

  const { data: order, isLoading: loading, error: queryError } = useGetOrderDetailQuery(orderId!, { skip: !orderId })
  const [toggleVisibility, { isLoading: toggling }] = useToggleOrderVisibilityMutation()
  const error = queryError ? 'Failed to load order' : ''

  const isOwner = userInformation?.user?.user_id === order?.user_id

  // Close the drawer by default when landing on this page
  useEffect(() => {
    dispatch(setLeftDrawerClosed())
    dispatch(setSelectedComponent({ selectedComponent: '' }))
  }, [])

  const handleToggleVisibility = async () => {
    if (!order) return
    await toggleVisibility(order.order_id)
  }

  const contentMargin = userInterfaceState.leftDrawerOpen
    ? `${DRAWER_WIDTH}px`
    : collapsedWidth

  if (loading) {
    return (
      <Box>
        <HeaderBar />
        <UpdatedUserInterface />
        <Box sx={{
          display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh',
          marginLeft: contentMargin,
          transition: theme.transitions.create(['margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}>
          <CircularProgress />
        </Box>
      </Box>
    )
  }

  if (error || !order) {
    return (
      <Box>
        <HeaderBar />
        <UpdatedUserInterface />
        <Box sx={{
          pt: 12, px: 4,
          marginLeft: contentMargin,
          transition: theme.transitions.create(['margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}>
          <Alert severity="error">{error || 'Order not found'}</Alert>
          <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
            Go Back
          </Button>
        </Box>
      </Box>
    )
  }

  return (
    <Box>
      <HeaderBar />
      <UpdatedUserInterface />
      <Box sx={{
        pt: 10, pb: 6, px: { xs: 2, md: 4 }, maxWidth: 1100, mx: 'auto',
        marginLeft: contentMargin,
        transition: theme.transitions.create(['margin'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
      }}>
        {/* Back button */}
        <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 3 }}>
          Back to Orders
        </Button>

        {/* Order Header */}
        <Paper elevation={3} sx={{ p: 4, borderRadius: 3, mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h4" fontWeight={700}>{order.name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Order placed {new Date(order.created_at).toLocaleDateString()}
                {' '} by {order.owner_username}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {isOwner && (
                <Chip
                  icon={order.is_collaborative ? <Public /> : <Lock />}
                  label={order.is_collaborative ? 'Community' : 'Private'}
                  color={order.is_collaborative ? 'success' : 'default'}
                  onClick={handleToggleVisibility}
                  disabled={toggling}
                  sx={{ cursor: 'pointer' }}
                />
              )}
              {order.qa_level === 'high' && (
                <Chip label="High QA" color="warning" variant="outlined" />
              )}
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Grid container spacing={3}>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">Material</Typography>
              <Typography variant="body1" fontWeight={500}>{order.material}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">Technique</Typography>
              <Typography variant="body1" fontWeight={500}>{order.technique}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">Colour</Typography>
              <Typography variant="body1" fontWeight={500}>{order.colour}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">Sizing</Typography>
              <Typography variant="body1" fontWeight={500}>{order.sizing}x</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">Price</Typography>
              <Typography variant="body1" fontWeight={500}>${order.price.toFixed(2)}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">Quantity</Typography>
              <Typography variant="body1" fontWeight={500}>{order.quantity}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">Claimed</Typography>
              <Typography variant="body1" fontWeight={500}>
                {order.quantity_claimed} / {order.quantity}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">File Type</Typography>
              <Typography variant="body1" fontWeight={500}>{order.selectedFileType.toUpperCase()}</Typography>
            </Grid>
          </Grid>

          {/* Shipping Address */}
          {order.shipping_name && (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Shipping Address
              </Typography>
              <Typography variant="body2">
                {order.shipping_name}
              </Typography>
              <Typography variant="body2">
                {order.shipping_line1}
                {order.shipping_line2 && `, ${order.shipping_line2}`}
              </Typography>
              <Typography variant="body2">
                {order.shipping_city}, {order.shipping_postal_code}
              </Typography>
              <Typography variant="body2">
                {order.shipping_country}
              </Typography>
            </>
          )}
        </Paper>

        {/* Claims Section */}
        <Typography variant="h5" fontWeight={600} sx={{ mb: 3 }}>
          Claims ({order.claims.length})
        </Typography>

        {order.claims.length === 0 ? (
          <Paper elevation={1} sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
            <LocalShipping sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.4 }} />
            <Typography variant="h6" color="text.secondary" sx={{ mt: 1 }}>
              No claims yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {order.is_collaborative
                ? 'This order is visible in the community marketplace. Fulfillers can claim it.'
                : 'Make this order public to allow fulfillers to claim it.'}
            </Typography>
          </Paper>
        ) : (
          order.claims.map((claim) => (
            <ClaimTracker
              key={claim.id}
              claim={claim}
              order={order}
              isOwner={isOwner}
            />
          ))
        )}
      </Box>
    </Box>
  )
}

// ── Claim Tracker with Timeline ──────────────────────────────

interface ClaimTrackerProps {
  claim: ClaimDetail
  order: { user_id: string; price: number; quantity: number; is_collaborative: boolean }
  isOwner: boolean
}

function ClaimTracker({ claim, order, isOwner }: ClaimTrackerProps) {
  const { userInformation } = useSelector((state: RootState) => state.userInterfaceState)
  const [updateStatus, { isLoading: statusLoading }] = useUpdateClaimStatusMutation()
  const [respondToDispute, { isLoading: respondLoading }] = useRespondToDisputeMutation()
  const [resolveDisputeMutation, { isLoading: resolveLoading }] = useResolveDisputeMutation()
  const [showDispute, setShowDispute] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [responseText, setResponseText] = useState('')
  const [partialAmount, setPartialAmount] = useState('')
  const [actionError, setActionError] = useState('')
  const acting = statusLoading || respondLoading || resolveLoading

  const isBuyer = userInformation?.user?.user_id === order.user_id
  const isFulfiller = userInformation?.user?.user_id === claim.claimant_user_id

  const isDisputed = claim.status === 'disputed' || claim.status.startsWith('resolved_')
  const currentStepIndex = CLAIM_STEPS.indexOf(claim.status)
  const activeStep = isDisputed ? CLAIM_STEPS.length : (currentStepIndex >= 0 ? currentStepIndex : 0)

  // Build timeline from status history
  const historyMap: Record<string, { date: string }> = {}
  claim.status_history.forEach((h) => {
    historyMap[h.new_status] = { date: h.changed_at }
  })

  const handleAccept = async () => {
    try {
      await updateStatus({ claimId: claim.id, status: 'accepted' }).unwrap()
    } catch (e: any) {
      setActionError(e.data?.detail || e.message)
    }
  }

  const handleDisputeSubmit = async () => {
    if (!disputeReason.trim()) return
    try {
      await updateStatus({ claimId: claim.id, status: 'disputed', reason: disputeReason }).unwrap()
    } catch (e: any) {
      setActionError(e.data?.detail || e.message)
    }
  }

  const handleRespond = async () => {
    if (!claim.dispute || !responseText.trim()) return
    try {
      await respondToDispute({ disputeId: claim.dispute.id, responseText }).unwrap()
    } catch (e: any) {
      setActionError(e.data?.detail || e.message)
    }
  }

  const handleResolve = async (resolution: 'accepted' | 'partial' | 'rejected') => {
    if (!claim.dispute) return
    try {
      const partial = resolution === 'partial' ? parseInt(partialAmount, 10) : undefined
      if (resolution === 'partial' && (!partial || partial <= 0)) {
        setActionError('Enter a valid partial amount in cents')
        return
      }
      await resolveDisputeMutation({ disputeId: claim.dispute.id, resolution, partialAmountCents: partial }).unwrap()
    } catch (e: any) {
      setActionError(e.data?.detail || e.message)
    }
  }

  return (
    <Paper elevation={2} sx={{ p: 3, borderRadius: 3, mb: 3 }}>
      {/* Claim Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Person color="action" />
          <Typography variant="h6" fontWeight={600}>
            {claim.claimant_username}
          </Typography>
          <Chip label={`Qty: ${claim.quantity}`} size="small" variant="outlined" />
        </Box>
        <Chip
          label={STEP_LABELS[claim.status] || claim.status.replace(/_/g, ' ')}
          color={STATUS_COLOR[claim.status] || 'default'}
          sx={{ fontWeight: 600 }}
        />
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Status Timeline */}
      <Stepper activeStep={activeStep} orientation="vertical" sx={{ mb: 3 }}>
        {CLAIM_STEPS.map((step, index) => {
          const stepDate = historyMap[step]?.date
          const isCompleted = index < activeStep
          const isCurrent = index === activeStep && !isDisputed

          return (
            <Step key={step} completed={isCompleted}>
              <StepLabel
                optional={
                  stepDate ? (
                    <Typography variant="caption" color="text.secondary">
                      {new Date(stepDate).toLocaleDateString()} {new Date(stepDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  ) : isCurrent ? (
                    <Typography variant="caption" color="primary">Current</Typography>
                  ) : null
                }
              >
                {STEP_LABELS[step]}
              </StepLabel>
            </Step>
          )
        })}

        {/* Dispute step (only if disputed/resolved) */}
        {isDisputed && (
          <Step completed={claim.status.startsWith('resolved_')}>
            <StepLabel
              error={claim.status === 'disputed'}
              icon={<Gavel color={claim.status === 'disputed' ? 'error' : 'success'} />}
              optional={
                <Typography variant="caption" color="text.secondary">
                  {historyMap['disputed']?.date
                    ? new Date(historyMap['disputed'].date).toLocaleDateString()
                    : ''}
                </Typography>
              }
            >
              {STEP_LABELS[claim.status] || 'Disputed'}
            </StepLabel>
          </Step>
        )}
      </Stepper>

      {/* Tracking Info */}
      {claim.tracking_number && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <LocalShipping fontSize="small" color="primary" />
            <Typography variant="subtitle2" fontWeight={600}>Shipping</Typography>
          </Box>
          <Typography variant="body2">
            Tracking: <strong>{claim.tracking_number}</strong> ({claim.carrier_code})
          </Typography>
          {claim.label_url && (
            <Button
              variant="outlined"
              size="small"
              href={claim.label_url}
              target="_blank"
              sx={{ mt: 1 }}
            >
              View Label (PDF)
            </Button>
          )}
        </Box>
      )}

      {/* Evidence Photos */}
      {claim.evidence.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Evidence Photos ({claim.evidence.length})
          </Typography>
          <ImageList cols={4} gap={8} sx={{ maxHeight: 200 }}>
            {claim.evidence.map((ev) => (
              <ImageListItem key={ev.id}>
                {ev.image_data ? (
                  <img
                    src={`data:image/jpeg;base64,${ev.image_data}`}
                    alt={ev.description || 'Evidence'}
                    loading="lazy"
                    style={{ borderRadius: 8, objectFit: 'cover' }}
                  />
                ) : (
                  <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="caption">No preview</Typography>
                  </Box>
                )}
              </ImageListItem>
            ))}
          </ImageList>
        </Box>
      )}

      {actionError && (
        <Alert severity="error" onClose={() => setActionError('')} sx={{ mb: 2 }}>{actionError}</Alert>
      )}

      {/* ── Buyer Actions ── */}

      {/* Delivered: buyer can accept or dispute */}
      {isBuyer && claim.status === 'delivered' && (
        <Box sx={{ mt: 2 }}>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            This order has been delivered. Review it below.
          </Typography>

          <Collapse in={showDispute}>
            <TextField
              label="Dispute Reason"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              fullWidth
              multiline
              rows={3}
              sx={{ mb: 2 }}
            />
          </Collapse>

          <Box display="flex" gap={2}>
            <Button
              variant="contained"
              color="success"
              onClick={handleAccept}
              disabled={acting}
              startIcon={<CheckCircle />}
            >
              Accept
            </Button>
            {!showDispute ? (
              <Button variant="outlined" color="error" onClick={() => setShowDispute(true)} startIcon={<Gavel />}>
                Dispute
              </Button>
            ) : (
              <Button
                variant="contained"
                color="error"
                onClick={handleDisputeSubmit}
                disabled={acting || !disputeReason.trim()}
                startIcon={<Gavel />}
              >
                Submit Dispute
              </Button>
            )}
          </Box>
        </Box>
      )}

      {/* ── Dispute Section ── */}
      {claim.dispute && <DisputeSection claim={claim} dispute={claim.dispute} isBuyer={isBuyer} isFulfiller={isFulfiller} responseText={responseText} setResponseText={setResponseText} partialAmount={partialAmount} setPartialAmount={setPartialAmount} acting={acting} onRespond={handleRespond} onResolve={handleResolve} />}
    </Paper>
  )
}

// ── Inline Dispute Section ───────────────────────────────────

interface DisputeSectionProps {
  claim: ClaimDetail
  dispute: Dispute
  isBuyer: boolean
  isFulfiller: boolean
  responseText: string
  setResponseText: (s: string) => void
  partialAmount: string
  setPartialAmount: (s: string) => void
  acting: boolean
  onRespond: () => void
  onResolve: (resolution: 'accepted' | 'partial' | 'rejected') => void
}

function DisputeSection({
  claim, dispute, isBuyer, isFulfiller,
  responseText, setResponseText, partialAmount, setPartialAmount,
  acting, onRespond, onResolve,
}: DisputeSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [evidenceDesc, setEvidenceDesc] = useState('')
  const [uploadEvidence] = useUploadDisputeEvidenceMutation()

  const handleUploadEvidence = async () => {
    if (!evidenceFile) return
    const reader = new FileReader()
    await new Promise<void>((resolve) => {
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1]
        await uploadEvidence({
          disputeId: dispute.id,
          imageData: base64,
          description: evidenceDesc || undefined,
        }).unwrap()
        setEvidenceFile(null)
        setEvidenceDesc('')
        resolve()
      }
      reader.readAsDataURL(evidenceFile)
    })
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Divider sx={{ mb: 2 }} />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Gavel color="error" />
        <Typography variant="subtitle1" fontWeight={600}>Dispute</Typography>
        <Chip
          label={dispute.status.toUpperCase()}
          size="small"
          color={dispute.status === 'resolved' ? 'success' : dispute.status === 'responded' ? 'warning' : 'error'}
        />
      </Box>

      <Typography variant="body2" sx={{ mb: 1 }}>
        <strong>Reason:</strong> {dispute.reason}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Opened {new Date(dispute.created_at).toLocaleDateString()}
      </Typography>

      {/* Deadline */}
      {dispute.status !== 'resolved' && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {dispute.status === 'open' && (
            <>Fulfiller must respond by <strong>{new Date(dispute.fulfiller_deadline).toLocaleDateString()}</strong>. Auto-resolves in buyer's favour if no response.</>
          )}
          {dispute.status === 'responded' && dispute.buyer_deadline && (
            <>Buyer must decide by <strong>{new Date(dispute.buyer_deadline).toLocaleDateString()}</strong>. Auto-resolves in fulfiller's favour if no action.</>
          )}
        </Alert>
      )}

      {/* Fulfiller's response */}
      {dispute.fulfiller_response && (
        <Paper variant="outlined" sx={{ p: 2, mt: 2, borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight={600}>Fulfiller Response</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>{dispute.fulfiller_response}</Typography>
          {dispute.responded_at && (
            <Typography variant="caption" color="text.secondary">
              {new Date(dispute.responded_at).toLocaleDateString()}
            </Typography>
          )}
        </Paper>
      )}

      {/* Fulfiller: respond to open dispute */}
      {isFulfiller && dispute.status === 'open' && (
        <Box sx={{ mt: 2 }}>
          <TextField
            label="Your Response"
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            fullWidth
            multiline
            rows={3}
            sx={{ mb: 2 }}
          />
          <Box sx={{ mb: 2 }}>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && setEvidenceFile(e.target.files[0])}
              style={{ display: 'none' }}
            />
            <Button variant="outlined" size="small" onClick={() => fileInputRef.current?.click()}>
              {evidenceFile ? evidenceFile.name : 'Upload Counter-Evidence'}
            </Button>
            {evidenceFile && (
              <Box sx={{ mt: 1 }}>
                <TextField label="Description" value={evidenceDesc} onChange={(e) => setEvidenceDesc(e.target.value)} size="small" fullWidth />
                <Button variant="outlined" size="small" onClick={handleUploadEvidence} sx={{ mt: 1 }}>Upload</Button>
              </Box>
            )}
          </Box>
          <Button variant="contained" onClick={onRespond} disabled={acting || !responseText.trim()}>
            Submit Response
          </Button>
        </Box>
      )}

      {/* Buyer: waiting for fulfiller */}
      {isBuyer && dispute.status === 'open' && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Waiting for fulfiller to respond. If they miss the deadline, the dispute auto-resolves in your favour.
        </Typography>
      )}

      {/* Buyer: resolve responded dispute */}
      {isBuyer && dispute.status === 'responded' && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>Your Decision</Typography>
          <TextField
            label="Partial amount (cents)"
            value={partialAmount}
            onChange={(e) => setPartialAmount(e.target.value)}
            type="number"
            size="small"
            sx={{ mb: 2, width: 250 }}
          />
          <Box display="flex" gap={1}>
            <Button variant="contained" color="success" size="small" onClick={() => onResolve('accepted')} disabled={acting}>Accept (Full Pay)</Button>
            <Button variant="contained" color="warning" size="small" onClick={() => onResolve('partial')} disabled={acting || !partialAmount}>Partial</Button>
            <Button variant="contained" color="error" size="small" onClick={() => onResolve('rejected')} disabled={acting}>Reject</Button>
          </Box>
        </Box>
      )}

      {/* Fulfiller: waiting for buyer */}
      {isFulfiller && dispute.status === 'responded' && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Response submitted. Waiting for buyer to review. Auto-resolves in your favour if they miss the deadline.
        </Typography>
      )}

      {/* Resolved */}
      {dispute.status === 'resolved' && (
        <Paper variant="outlined" sx={{ p: 2, mt: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
          <Typography variant="subtitle2" fontWeight={600}>Resolution</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            {dispute.resolution === 'accepted' && 'Full payment released to fulfiller.'}
            {dispute.resolution === 'partial' && `Partial payment of ${dispute.resolution_amount_cents} cents released.`}
            {dispute.resolution === 'rejected' && 'Payment cancelled. Buyer refunded.'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Resolved by {dispute.resolved_by === 'auto' ? 'auto (deadline expired)' : 'buyer'}
            {dispute.resolved_at && ` on ${new Date(dispute.resolved_at).toLocaleDateString()}`}
          </Typography>
        </Paper>
      )}
    </Box>
  )
}
