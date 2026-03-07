import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../app/store'
import { setClaimedOrder, setFulfillMode } from '../../services/userInterfaceSlice'
import { resetDataState } from '../../services/dataSlice'
import { ClaimOrder } from '../../app/utility/interfaces'
import logger from '../../app/utility/logger'
import { useClaimOrderMutation } from '../../services/dbApi'
import { Snackbar, Alert } from '@mui/material'
import { ClaimPanel } from '../shared/ClaimPanel'

export function ClaimMenu() {
  const { claimedOrder } = useSelector(
    (state: RootState) => state.userInterfaceState
  )
  const dispatch = useDispatch()
  const [claimOrder] = useClaimOrderMutation()
  const [snackbar, setSnackbar] = useState({ open: false, message: '' })

  const confirmClaim = async (quantity: number) => {
    const claim: ClaimOrder = {
      order_id: claimedOrder.order_id,
      quantity,
      status: 'pending',
    }
    try {
      await claimOrder(claim).unwrap()
      dispatch(setClaimedOrder({ claimedOrder: null }))
    } catch (err) {
      logger.error('Error claiming order:', err)
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
