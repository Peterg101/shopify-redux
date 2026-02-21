import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../app/store'
import { setClaimedOrder } from '../../services/userInterfaceSlice'
import { resetDataState, setFulfillMode } from '../../services/dataSlice'
import { ClaimOrder } from '../../app/utility/interfaces'
import { postClaimOrder } from '../../services/fetchFileUtils'
import { authApi } from '../../services/authApi'
import { ClaimPanel } from '../shared/ClaimPanel'

export const ClaimMenu: React.FC = () => {
  const { claimedOrder } = useSelector(
    (state: RootState) => state.userInterfaceState
  )
  const dispatch = useDispatch()

  const confirmClaim = async (quantity: number) => {
    const claimOrder: ClaimOrder = {
      order_id: claimedOrder.order_id,
      quantity,
      status: 'pending',
    }
    await postClaimOrder(claimOrder)
    dispatch(authApi.util.invalidateTags(['sessionData']))
    dispatch(setClaimedOrder({ claimedOrder: null }))
  }

  const handleCancel = () => {
    dispatch(setClaimedOrder({ claimedOrder: null }))
    dispatch(resetDataState())
    dispatch(setFulfillMode({ fulfillMode: false }))
  }

  return (
    <ClaimPanel
      order={claimedOrder}
      mode="claim"
      onConfirm={confirmClaim}
      onCancel={handleCancel}
    />
  )
}
