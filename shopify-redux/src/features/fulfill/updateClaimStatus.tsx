import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../app/store'
import { setUpdateClaimedOrder } from '../../services/userInterfaceSlice'
import { resetDataState, setUpdateClaimMode } from '../../services/dataSlice'
import { patchClaimStatus, uploadClaimEvidence, createShippingLabel } from '../../services/fetchFileUtils'
import { authApi } from '../../services/authApi'
import { useState, useRef } from 'react'
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
} from '@mui/material'
import OBJSTLViewer from '../display/objStlViewer'
import { BuyerReviewPanel } from './BuyerReviewPanel'
import { DisputePanel } from './DisputePanel'

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['in_progress'],
  in_progress: ['printing'],
  printing: ['qa_check'],
  qa_check: ['shipped'],
  shipped: ['delivered'],
  delivered: ['accepted', 'disputed'],
}

export const UpdateClaimStatus = () => {
  const { updateClaimedOrder, userInformation } = useSelector(
    (state: RootState) => state.userInterfaceState
  )
  const dispatch = useDispatch()

  const currentStatus = updateClaimedOrder?.status ?? 'pending'
  const validNextStatuses = ALLOWED_TRANSITIONS[currentStatus] ?? []
  const [selectedStatus, setSelectedStatus] = useState(validNextStatuses[0] ?? '')

  // Photo upload state
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [evidenceDescription, setEvidenceDescription] = useState('')
  const [labelResult, setLabelResult] = useState<{ label_url: string; tracking_number: string; carrier_code: string } | null>(null)
  const [labelError, setLabelError] = useState('')
  const [creatingLabel, setCreatingLabel] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' as 'error' | 'warning' })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.size > 5 * 1024 * 1024) {
        setSnackbar({ open: true, message: 'File too large — maximum 5MB', severity: 'error' })
        return
      }
      if (!file.type.startsWith('image/')) {
        setSnackbar({ open: true, message: 'Only image files are accepted', severity: 'error' })
        return
      }
      setEvidenceFile(file)
    }
  }

  const confirmUpdate = async () => {
    if (!updateClaimedOrder || !selectedStatus) return

    if (currentStatus === 'qa_check' && updateClaimedOrder.order.qa_level === 'high' && !evidenceFile) {
      setSnackbar({ open: true, message: 'Evidence photo required for high-QA orders before shipping', severity: 'error' })
      return
    }

    // Upload evidence before status patch if file selected
    if (evidenceFile) {
      const reader = new FileReader()
      await new Promise<void>((resolve) => {
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1]
          await uploadClaimEvidence(updateClaimedOrder.id, base64, evidenceDescription || undefined)
          resolve()
        }
        reader.readAsDataURL(evidenceFile)
      })
    }

    // Auto-create shipping label when moving to "shipped"
    if (selectedStatus === 'shipped') {
      setCreatingLabel(true)
      setLabelError('')
      try {
        const result = await createShippingLabel(updateClaimedOrder.id)
        setLabelResult(result)
      } catch (err: any) {
        setLabelError(err.message || 'Failed to create shipping label. You can create it manually later.')
        // Don't return — allow status update to proceed
      }
      setCreatingLabel(false)
    }

    await patchClaimStatus(updateClaimedOrder.id, selectedStatus)
    dispatch(authApi.util.invalidateTags(['sessionData']))
    dispatch(setUpdateClaimedOrder({ updateClaimedOrder: null }))
    dispatch(setUpdateClaimMode({ updateClaimMode: false }))
    dispatch(resetDataState())
  }

  const handleCancel = () => {
    dispatch(setUpdateClaimedOrder({ updateClaimedOrder: null }))
    dispatch(resetDataState())
    dispatch(setUpdateClaimMode({ updateClaimMode: false }))
  }

  if (!updateClaimedOrder) return null
  const order = updateClaimedOrder.order

  // If claim is delivered and current user is the buyer, show buyer review panel
  const isBuyer = userInformation?.user?.user_id === order.user_id
  if (currentStatus === 'delivered' && isBuyer) {
    return <BuyerReviewPanel claim={updateClaimedOrder} onClose={handleCancel} />
  }

  // If claim is disputed or resolved, show dispute panel
  if (currentStatus === 'disputed' || currentStatus.startsWith('resolved_')) {
    return <DisputePanel claim={updateClaimedOrder} onClose={handleCancel} />
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
      <Grid
        container
        spacing={4}
        sx={{ maxWidth: 1200, width: '100%', alignItems: 'stretch' }}
      >
        <Grid item xs={12} md={7}>
          <Paper
            elevation={4}
            sx={{
              borderRadius: 3,
              overflow: 'hidden',
              height: '100%',
              minHeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <OBJSTLViewer />
          </Paper>
        </Grid>

        <Grid
          item
          xs={12}
          md={5}
          sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
        >
          <Paper elevation={2} sx={{ flex: 1, p: 3, borderRadius: 3 }}>
            <Typography variant="h5" fontWeight={600} gutterBottom>
              Order Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="body1"><strong>Name:</strong> {order.name}</Typography>
              <Typography variant="body1"><strong>Material:</strong> {order.material}</Typography>
              <Typography variant="body1"><strong>Technique:</strong> {order.technique}</Typography>
              <Typography variant="body1"><strong>Colour:</strong> {order.colour}</Typography>
              <Typography variant="body1"><strong>Quantity Claimed:</strong> {updateClaimedOrder.quantity}</Typography>
              <Typography variant="body1"><strong>Current Status:</strong> {currentStatus.replace(/_/g, ' ')}</Typography>
              <Typography variant="body1"><strong>QA Level:</strong> {order.qa_level || 'standard'}</Typography>
            </Box>
          </Paper>

          <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
            <Typography variant="h5" fontWeight={600} gutterBottom>
              Update Status
            </Typography>
            <Divider sx={{ mb: 3 }} />

            {/* Photo evidence upload */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {currentStatus === 'qa_check' && order.qa_level === 'high'
                  ? 'Upload QA evidence photo (required for high-QA orders)'
                  : 'Upload photo evidence (optional)'}
              </Typography>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                onClick={() => fileInputRef.current?.click()}
                sx={{ mb: 1 }}
              >
                {evidenceFile ? evidenceFile.name : 'Choose Photo'}
              </Button>
              {evidenceFile && (
                <TextField
                  label="Evidence Description"
                  value={evidenceDescription}
                  onChange={(e) => setEvidenceDescription(e.target.value)}
                  fullWidth
                  size="small"
                  sx={{ mt: 1 }}
                />
              )}
            </Box>

            {validNextStatuses.length > 0 ? (
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>New Status</InputLabel>
                <Select
                  value={selectedStatus}
                  label="New Status"
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  {validNextStatuses.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s.replace('_', ' ')}
                    </MenuItem>
                  ))}
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

            {labelResult && (
              <Box sx={{ mb: 3, p: 2, bgcolor: 'success.light', borderRadius: 2 }}>
                <Typography variant="body2" fontWeight={600}>
                  Shipping label created!
                </Typography>
                <Typography variant="body2">
                  Tracking: {labelResult.tracking_number} ({labelResult.carrier_code})
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  href={labelResult.label_url}
                  target="_blank"
                  sx={{ mt: 1 }}
                >
                  Download Label (PDF)
                </Button>
              </Box>
            )}

            <Box display="flex" gap={2}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                disabled={!selectedStatus || validNextStatuses.length === 0 || creatingLabel}
                onClick={confirmUpdate}
                sx={{ py: 1.4, borderRadius: 2, fontWeight: 600 }}
              >
                {creatingLabel ? 'Creating Label...' : 'Confirm'}
              </Button>
              <Button
                variant="outlined"
                size="large"
                fullWidth
                onClick={handleCancel}
                sx={{ py: 1.4, borderRadius: 2, fontWeight: 600 }}
              >
                Cancel
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
