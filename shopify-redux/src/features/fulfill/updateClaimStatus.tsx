import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../app/store'
import { setUpdateClaimedOrder } from '../../services/userInterfaceSlice'
import { resetDataState, setUpdateClaimMode } from '../../services/dataSlice'
import { patchClaimStatus, uploadClaimEvidence } from '../../services/fetchFileUtils'
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
} from '@mui/material'
import OBJSTLViewer from '../display/objStlViewer'
import { BuyerReviewPanel } from './BuyerReviewPanel'

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['in_progress'],
  in_progress: ['printing'],
  printing: ['shipped'],
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setEvidenceFile(e.target.files[0])
    }
  }

  const confirmUpdate = async () => {
    if (!updateClaimedOrder || !selectedStatus) return

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
              <Typography variant="body1"><strong>Current Status:</strong> {currentStatus}</Typography>
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
                Upload photo evidence (optional)
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

            <Box display="flex" gap={2}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                disabled={!selectedStatus || validNextStatuses.length === 0}
                onClick={confirmUpdate}
                sx={{ py: 1.4, borderRadius: 2, fontWeight: 600 }}
              >
                Confirm
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
    </Box>
  )
}
