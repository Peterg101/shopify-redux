import { useState } from 'react'
import { useDispatch } from 'react-redux'
import {
  Box,
  Typography,
  IconButton,
  Chip,
} from '@mui/material'
import { Add, Remove } from '@mui/icons-material'
import { Claim } from '../../app/utility/interfaces'
import logger from '../../app/utility/logger'
import { setUpdateClaimedOrder } from '../../services/userInterfaceSlice'
import { setUpdateClaimMode } from '../../services/dataSlice'
import { useOrderFileLoader } from '../../hooks/useOrderFileLoader'
import { OrderDetailCard } from '../shared/OrderDetailCard'
import { patchClaimQuantity } from '../../services/fetchFileUtils'
import { authApi } from '../../services/authApi'

export function ClaimCard({ claim }: { claim: Claim }) {
  const dispatch = useDispatch()
  const { prepareOrderFile } = useOrderFileLoader()
  const [adjusting, setAdjusting] = useState(false)

  const handleUpdateClaim = async () => {
    await prepareOrderFile(claim.order)
    dispatch(setUpdateClaimMode({ updateClaimMode: true }))
    dispatch(setUpdateClaimedOrder({ updateClaimedOrder: claim }))
  }

  const order = claim.order
  const otherClaimed = (order.claims || [])
    .filter((c) => c.id !== claim.id)
    .reduce((sum, c) => sum + c.quantity, 0)
  const maxAvailable = order.quantity - otherClaimed

  const handleQuantityChange = async (delta: number) => {
    const newQuantity = claim.quantity + delta
    if (newQuantity < 1 || newQuantity > maxAvailable) return
    setAdjusting(true)
    try {
      await patchClaimQuantity(claim.id, newQuantity)
      dispatch(authApi.util.invalidateTags(['sessionData']))
    } catch (err) {
      logger.error('Error adjusting quantity:', err)
    } finally {
      setAdjusting(false)
    }
  }

  return (
    <Box>
      <OrderDetailCard
        order={claim.order}
        variant="claimed"
        onAction={handleUpdateClaim}
        actionLabel="Update Claim Status"
      />
      {claim.status === 'pending' && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            mt: -1,
            mb: 1,
            px: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Adjust quantity:
          </Typography>
          <IconButton
            size="small"
            onClick={() => handleQuantityChange(-1)}
            disabled={adjusting || claim.quantity <= 1}
          >
            <Remove fontSize="small" />
          </IconButton>
          <Chip
            label={claim.quantity}
            size="small"
            color="primary"
            sx={{ minWidth: 40, fontWeight: 600 }}
          />
          <IconButton
            size="small"
            onClick={() => handleQuantityChange(1)}
            disabled={adjusting || claim.quantity >= maxAvailable}
          >
            <Add fontSize="small" />
          </IconButton>
          <Typography variant="caption" color="text.secondary">
            / {maxAvailable} available
          </Typography>
        </Box>
      )}
    </Box>
  )
}
