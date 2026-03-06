import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../app/store'
import { setClaimedOrder } from '../../services/userInterfaceSlice'
import { resetDataState, setFulfillMode } from '../../services/dataSlice'
import { ClaimOrder } from '../../app/utility/interfaces'
import { postClaimOrder } from '../../services/fetchFileUtils'
import { authApi } from '../../services/authApi'
import { Snackbar, Alert } from '@mui/material'
import { ClaimPanel } from '../shared/ClaimPanel'

export const ClaimMenu: React.FC = () => {
  const { claimedOrder } = useSelector(
    (state: RootState) => state.userInterfaceState
  )
  const dispatch = useDispatch()
  const [snackbar, setSnackbar] = useState({ open: false, message: '' })

  const confirmClaim = async (quantity: number) => {
    const claimOrder: ClaimOrder = {
      order_id: claimedOrder.order_id,
      quantity,
      status: 'pending',
    }
    try {
      await postClaimOrder(claimOrder)
      dispatch(authApi.util.invalidateTags(['sessionData']))
      dispatch(setClaimedOrder({ claimedOrder: null }))
    } catch (err) {
      console.error('Error claiming order:', err)
      setSnackbar({ open: true, message: 'Failed to claim order. Please try again.' })
    }
  }

  const handleCancel = () => {
    dispatch(setClaimedOrder({ claimedOrder: null }))
    dispatch(resetDataState())
    dispatch(setFulfillMode({ fulfillMode: false }))
  }

  return (
    <>
      <ClaimPanel
        order={claimedOrder}
        mode="claim"
        onConfirm={confirmClaim}
        onCancel={handleCancel}
      />
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity="error" onClose={() => setSnackbar({ open: false, message: '' })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  )
}
