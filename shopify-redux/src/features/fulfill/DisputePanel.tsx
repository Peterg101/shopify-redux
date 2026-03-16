import React, { useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box,
  Typography,
  Paper,
  Divider,
  Grid,
  Button,
  TextField,
  ImageList,
  ImageListItem,
  Chip,
  Alert,
} from '@mui/material'
import { RootState } from '../../app/store'
import { Claim } from '../../app/utility/interfaces'
import {
  useGetDisputeQuery,
  useGetClaimEvidenceQuery,
  useRespondToDisputeMutation,
  useResolveDisputeMutation,
  useUploadDisputeEvidenceMutation,
} from '../../services/dbApi'
import { setSelectedClaim, setUpdateClaimMode } from '../../services/userInterfaceSlice'
import { resetDataState } from '../../services/dataSlice'

interface DisputePanelProps {
  claim: Claim
  onClose: () => void
}

function formatDeadline(deadline: string): string {
  const d = new Date(deadline)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  if (diff <= 0) return 'Expired'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  return `${days}d ${hours}h remaining`
}

export function DisputePanel({ claim, onClose }: DisputePanelProps) {
  const dispatch = useDispatch()
  const { userInformation } = useSelector((state: RootState) => state.userInterfaceState)

  const { data: dispute, isLoading: loadingDispute } = useGetDisputeQuery(claim.id)
  const { data: evidence = [] } = useGetClaimEvidenceQuery(claim.id)
  const [respondToDispute] = useRespondToDisputeMutation()
  const [resolveDisputeMutation] = useResolveDisputeMutation()
  const [uploadEvidence] = useUploadDisputeEvidenceMutation()

  const [error, setError] = useState('')

  // Fulfiller response state
  const [responseText, setResponseText] = useState('')

  // Buyer resolution state
  const [partialAmount, setPartialAmount] = useState('')

  // Evidence upload state
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [evidenceDescription, setEvidenceDescription] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isBuyer = userInformation?.user?.user_id === claim.order?.user_id
  const isFulfiller = userInformation?.user?.user_id === claim.claimant_user_id

  const handleEvidenceFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large — maximum 5MB')
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Only image files are accepted')
      return
    }
    setEvidenceFile(file)
  }

  const handleDone = () => {
    dispatch(setSelectedClaim({ selectedClaim: null }))
    dispatch(setUpdateClaimMode({ updateClaimMode: false }))
    dispatch(resetDataState())
  }

  const handleRespond = async () => {
    if (!dispute || !responseText.trim()) return
    try {
      await respondToDispute({ disputeId: dispute.id, responseText }).unwrap()
      handleDone()
    } catch (e: any) {
      setError(e.data?.detail || e.message)
    }
  }

  const handleUploadEvidence = async () => {
    if (!dispute || !evidenceFile) return
    const reader = new FileReader()
    await new Promise<void>((resolve) => {
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1]
        await uploadEvidence({
          disputeId: dispute.id,
          imageData: base64,
          description: evidenceDescription || undefined,
        }).unwrap()
        setEvidenceFile(null)
        setEvidenceDescription('')
        resolve()
      }
      reader.readAsDataURL(evidenceFile)
    })
  }

  const handleResolve = async (resolution: 'accepted' | 'partial' | 'rejected') => {
    if (!dispute) return
    try {
      const partial = resolution === 'partial' ? parseInt(partialAmount, 10) : undefined
      if (resolution === 'partial' && (!partial || partial <= 0)) {
        setError('Enter a valid partial amount in cents')
        return
      }
      if (resolution === 'partial' && partial) {
        const order = claim.order
        const maxCents = Math.round(order.price * claim.quantity * 100)
        if (partial > maxCents) {
          setError(`Partial amount cannot exceed claim value (${maxCents} cents / $${(maxCents / 100).toFixed(2)})`)
          return
        }
      }
      await resolveDisputeMutation({ disputeId: dispute.id, resolution, partialAmountCents: partial }).unwrap()
      handleDone()
    } catch (e: any) {
      setError(e.data?.detail || e.message)
    }
  }

  if (loadingDispute || !dispute) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <Typography>Loading dispute...</Typography>
      </Box>
    )
  }

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
      <Grid container spacing={3} sx={{ maxWidth: 900, width: '100%' }}>
        {/* Dispute Info Header */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h5" fontWeight={600}>
                Dispute
              </Typography>
              <Chip
                label={dispute.status.toUpperCase()}
                color={dispute.status === 'resolved' ? 'success' : dispute.status === 'responded' ? 'warning' : 'error'}
              />
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body1"><strong>Reason:</strong> {dispute.reason}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Opened: {new Date(dispute.created_at).toLocaleDateString()}
            </Typography>
          </Paper>
        </Grid>

        {error && (
          <Grid item xs={12}>
            <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
          </Grid>
        )}

        {/* Deadline timer */}
        {dispute.status !== 'resolved' && (
          <Grid item xs={12}>
            <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
              {dispute.status === 'open' && (
                <Typography variant="body2">
                  Fulfiller response deadline: <strong>{formatDeadline(dispute.fulfiller_deadline)}</strong>
                </Typography>
              )}
              {dispute.status === 'responded' && dispute.buyer_deadline && (
                <Typography variant="body2">
                  Buyer review deadline: <strong>{formatDeadline(dispute.buyer_deadline)}</strong>
                </Typography>
              )}
            </Paper>
          </Grid>
        )}

        {/* Fulfiller's response (if any) */}
        {dispute.fulfiller_response && (
          <Grid item xs={12}>
            <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Fulfiller Response
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body1">{dispute.fulfiller_response}</Typography>
              {dispute.responded_at && (
                <Typography variant="caption" color="text.secondary">
                  Responded: {new Date(dispute.responded_at).toLocaleDateString()}
                </Typography>
              )}
            </Paper>
          </Grid>
        )}

        {/* Evidence photos */}
        {evidence.length > 0 && (
          <Grid item xs={12}>
            <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Evidence</Typography>
              <Divider sx={{ mb: 2 }} />
              <ImageList cols={3} gap={8}>
                {evidence.map((ev) => (
                  <ImageListItem key={ev.id}>
                    {ev.image_data && (
                      <img
                        src={`data:image/jpeg;base64,${ev.image_data}`}
                        alt={ev.description || 'Evidence'}
                        loading="lazy"
                        style={{ borderRadius: 8 }}
                      />
                    )}
                    {ev.description && (
                      <Typography variant="caption" color="text.secondary">{ev.description}</Typography>
                    )}
                  </ImageListItem>
                ))}
              </ImageList>
            </Paper>
          </Grid>
        )}

        {/* FULFILLER: Open dispute — respond + upload evidence */}
        {isFulfiller && dispute.status === 'open' && (
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Your Response</Typography>
              <Divider sx={{ mb: 2 }} />
              <TextField
                label="Response"
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                fullWidth
                multiline
                rows={4}
                sx={{ mb: 2 }}
              />

              {/* Counter-evidence upload */}
              <Box sx={{ mb: 2 }}>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleEvidenceFileSelect}
                  style={{ display: 'none' }}
                />
                <Button variant="outlined" size="small" onClick={() => fileInputRef.current?.click()} sx={{ mr: 1 }}>
                  {evidenceFile ? evidenceFile.name : 'Upload Counter-Evidence'}
                </Button>
                {evidenceFile && (
                  <>
                    <TextField
                      label="Description"
                      value={evidenceDescription}
                      onChange={(e) => setEvidenceDescription(e.target.value)}
                      size="small"
                      sx={{ mt: 1, width: '100%' }}
                    />
                    <Button variant="outlined" size="small" onClick={handleUploadEvidence} sx={{ mt: 1 }}>
                      Upload
                    </Button>
                  </>
                )}
              </Box>

              <Box display="flex" gap={2}>
                <Button variant="contained" color="primary" fullWidth onClick={handleRespond} disabled={!responseText.trim()}>
                  Submit Response
                </Button>
                <Button variant="outlined" fullWidth onClick={onClose}>
                  Cancel
                </Button>
              </Box>
            </Paper>
          </Grid>
        )}

        {/* BUYER: Open dispute — waiting for fulfiller */}
        {isBuyer && dispute.status === 'open' && (
          <Grid item xs={12}>
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="body1" color="text.secondary">
                Waiting for fulfiller to respond. If they don't respond by the deadline, the dispute will auto-resolve in your favour.
              </Typography>
              <Button variant="outlined" onClick={onClose} sx={{ mt: 2 }}>
                Close
              </Button>
            </Paper>
          </Grid>
        )}

        {/* BUYER: Responded — review and resolve */}
        {isBuyer && dispute.status === 'responded' && (
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Your Decision</Typography>
              <Divider sx={{ mb: 2 }} />

              <TextField
                label="Partial amount (cents) — only for partial refund"
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
                type="number"
                fullWidth
                size="small"
                sx={{ mb: 3 }}
              />

              <Box display="flex" gap={2}>
                <Button variant="contained" color="success" fullWidth onClick={() => handleResolve('accepted')}>
                  Accept (Full Pay)
                </Button>
                <Button variant="contained" color="warning" fullWidth onClick={() => handleResolve('partial')} disabled={!partialAmount}>
                  Partial Refund
                </Button>
                <Button variant="contained" color="error" fullWidth onClick={() => handleResolve('rejected')}>
                  Reject (No Pay)
                </Button>
              </Box>
              <Button variant="outlined" fullWidth onClick={onClose} sx={{ mt: 2 }}>
                Cancel
              </Button>
            </Paper>
          </Grid>
        )}

        {/* FULFILLER: Responded — waiting for buyer */}
        {isFulfiller && dispute.status === 'responded' && (
          <Grid item xs={12}>
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="body1" color="text.secondary">
                Your response has been submitted. Waiting for the buyer to review. If they don't act by the deadline, the dispute will auto-resolve in your favour.
              </Typography>
              <Button variant="outlined" onClick={onClose} sx={{ mt: 2 }}>
                Close
              </Button>
            </Paper>
          </Grid>
        )}

        {/* BOTH: Resolved */}
        {dispute.status === 'resolved' && (
          <Grid item xs={12}>
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Resolution</Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body1">
                <strong>Outcome:</strong>{' '}
                {dispute.resolution === 'accepted' && 'Full payment released to fulfiller'}
                {dispute.resolution === 'partial' && `Partial payment of ${dispute.resolution_amount_cents} cents released`}
                {dispute.resolution === 'rejected' && 'Payment cancelled — buyer refunded'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Resolved by: {dispute.resolved_by === 'auto' ? 'Auto (deadline expired)' : 'Buyer'}
                {dispute.resolved_at && ` on ${new Date(dispute.resolved_at).toLocaleDateString()}`}
              </Typography>
              <Button variant="outlined" onClick={handleDone} sx={{ mt: 2 }}>
                Done
              </Button>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  )
}
