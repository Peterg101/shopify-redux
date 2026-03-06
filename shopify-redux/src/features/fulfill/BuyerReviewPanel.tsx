import React, { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
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
  Alert,
} from '@mui/material'
import { Claim, ClaimEvidence } from '../../app/utility/interfaces'
import logger from '../../app/utility/logger'
import { patchClaimStatus, fetchClaimEvidence } from '../../services/fetchFileUtils'
import { authApi } from '../../services/authApi'
import { setUpdateClaimedOrder } from '../../services/userInterfaceSlice'
import { resetDataState, setUpdateClaimMode } from '../../services/dataSlice'

interface BuyerReviewPanelProps {
  claim: Claim
  onClose: () => void
}

export function BuyerReviewPanel({ claim, onClose }: BuyerReviewPanelProps) {
  const dispatch = useDispatch()
  const [evidence, setEvidence] = useState<ClaimEvidence[]>([])
  const [error, setError] = useState('')
  const [showDispute, setShowDispute] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')

  useEffect(() => {
    fetchClaimEvidence(claim.id).then(setEvidence).catch(logger.error)
  }, [claim.id])

  const handleAccept = async () => {
    try {
      await patchClaimStatus(claim.id, 'accepted')
      dispatch(authApi.util.invalidateTags(['sessionData']))
      dispatch(setUpdateClaimedOrder({ updateClaimedOrder: null }))
      dispatch(setUpdateClaimMode({ updateClaimMode: false }))
      dispatch(resetDataState())
    } catch (err) {
      logger.error('Error accepting claim:', err)
      setError('Failed to accept claim. Please try again.')
    }
  }

  const handleDispute = async () => {
    if (!disputeReason.trim()) return
    try {
      await patchClaimStatus(claim.id, 'disputed', disputeReason)
      dispatch(authApi.util.invalidateTags(['sessionData']))
      dispatch(setUpdateClaimedOrder({ updateClaimedOrder: null }))
      dispatch(setUpdateClaimMode({ updateClaimMode: false }))
      dispatch(resetDataState())
    } catch (err) {
      logger.error('Error disputing claim:', err)
      setError('Failed to submit dispute. Please try again.')
    }
  }

  const order = claim.order

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
      <Grid container spacing={4} sx={{ maxWidth: 1200, width: '100%' }}>
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h5" fontWeight={600} gutterBottom>
              Review Delivered Order
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="body1"><strong>Name:</strong> {order.name}</Typography>
              <Typography variant="body1"><strong>Material:</strong> {order.material}</Typography>
              <Typography variant="body1"><strong>Technique:</strong> {order.technique}</Typography>
              <Typography variant="body1"><strong>Colour:</strong> {order.colour}</Typography>
              <Typography variant="body1"><strong>Quantity:</strong> {claim.quantity}</Typography>
              {claim.tracking_number && (
                <>
                  <Typography variant="body1"><strong>Tracking:</strong> {claim.tracking_number}</Typography>
                  {claim.carrier_code && (
                    <Typography variant="body1"><strong>Carrier:</strong> {claim.carrier_code}</Typography>
                  )}
                </>
              )}
            </Box>
          </Paper>
        </Grid>

        {error && (
          <Grid item xs={12}>
            <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
          </Grid>
        )}

        {evidence.length > 0 && (
          <Grid item xs={12}>
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Evidence Photos
              </Typography>
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
                      <Typography variant="caption" color="text.secondary">
                        {ev.description}
                      </Typography>
                    )}
                  </ImageListItem>
                ))}
              </ImageList>
            </Paper>
          </Grid>
        )}

        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Your Decision
            </Typography>
            <Divider sx={{ mb: 3 }} />

            {showDispute && (
              <TextField
                label="Dispute Reason"
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                fullWidth
                multiline
                rows={3}
                sx={{ mb: 3 }}
              />
            )}

            <Box display="flex" gap={2}>
              <Button
                variant="contained"
                color="secondary"
                size="large"
                fullWidth
                onClick={handleAccept}
                sx={{ py: 1.4, borderRadius: 2, fontWeight: 600 }}
              >
                Accept
              </Button>
              {!showDispute ? (
                <Button
                  variant="outlined"
                  color="error"
                  size="large"
                  fullWidth
                  onClick={() => setShowDispute(true)}
                  sx={{ py: 1.4, borderRadius: 2, fontWeight: 600 }}
                >
                  Dispute
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="error"
                  size="large"
                  fullWidth
                  onClick={handleDispute}
                  sx={{ py: 1.4, borderRadius: 2, fontWeight: 600 }}
                >
                  Submit Dispute
                </Button>
              )}
              <Button
                variant="outlined"
                size="large"
                fullWidth
                onClick={onClose}
                sx={{ py: 1.4, borderRadius: 2, fontWeight: 600 }}
              >
                Cancel
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
