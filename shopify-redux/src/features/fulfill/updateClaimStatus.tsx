import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../app/store'
import { setUpdateClaimedOrder } from '../../services/userInterfaceSlice'
import { resetDataState, setUpdateClaimMode } from '../../services/dataSlice'
import { patchClaimStatus } from '../../services/fetchFileUtils'
import { authApi } from '../../services/authApi'
import { useState } from 'react'
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
} from '@mui/material'
import OBJSTLViewer from '../display/objStlViewer'

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['in_progress'],
  in_progress: ['printing', 'shipped', 'completed'],
  printing: ['shipped'],
  shipped: ['completed'],
}

export const UpdateClaimStatus = () => {
  const { updateClaimedOrder } = useSelector(
    (state: RootState) => state.userInterfaceState
  )
  const dispatch = useDispatch()

  const currentStatus = updateClaimedOrder?.status ?? 'pending'
  const validNextStatuses = ALLOWED_TRANSITIONS[currentStatus] ?? []
  const [selectedStatus, setSelectedStatus] = useState(validNextStatuses[0] ?? '')

  const confirmUpdate = async () => {
    if (!updateClaimedOrder || !selectedStatus) return
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
