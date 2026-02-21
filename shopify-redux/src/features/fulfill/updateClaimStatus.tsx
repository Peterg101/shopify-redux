import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../app/store'
import { setUpdateClaimedOrder } from '../../services/userInterfaceSlice'
import { resetDataState, setFulfillMode } from '../../services/dataSlice'
import { ClaimOrder } from '../../app/utility/interfaces'
import { postClaimOrder } from '../../services/fetchFileUtils'
import { generateUuid } from '../../app/utility/utils'
import { authApi } from '../../services/authApi'
import { ClaimPanel } from '../shared/ClaimPanel'

export const UpdateClaimStatus = () => {
  const { updateClaimedOrder } = useSelector(
    (state: RootState) => state.userInterfaceState
  )
  const dispatch = useDispatch()

  const confirmUpdate = async (quantity: number) => {
    const claimOrder: ClaimOrder = {
      id: generateUuid(),
      order_id: updateClaimedOrder.order_id,
      quantity,
      status: 'in_progress',
    }
    await postClaimOrder(claimOrder)
    dispatch(authApi.util.invalidateTags(['sessionData']))
    dispatch(setUpdateClaimedOrder({ updateClaimedOrder: null }))
  }

  const handleCancel = () => {
    dispatch(setUpdateClaimedOrder({ updateClaimedOrder: null }))
    dispatch(resetDataState())
    dispatch(setFulfillMode({ fulfillMode: false }))
  }

  return (
    <ClaimPanel
      order={updateClaimedOrder}
      mode="update"
      onConfirm={confirmUpdate}
      onCancel={handleCancel}
    />
  )
}
