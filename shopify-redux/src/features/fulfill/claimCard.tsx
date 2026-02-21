import { useDispatch } from 'react-redux'
import { Order } from '../../app/utility/interfaces'
import { setUpdateClaimedOrder } from '../../services/userInterfaceSlice'
import { setUpdateClaimMode } from '../../services/dataSlice'
import { useOrderFileLoader } from '../../hooks/useOrderFileLoader'
import { OrderDetailCard } from '../shared/OrderDetailCard'

export const ClaimCard: React.FC<Order> = (order) => {
  const dispatch = useDispatch()
  const { prepareOrderFile } = useOrderFileLoader()

  const handleUpdateClaim = async (order: Order) => {
    await prepareOrderFile(order)
    dispatch(setUpdateClaimMode({ updateClaimMode: true }))
    dispatch(setUpdateClaimedOrder({ updateClaimedOrder: order }))
  }

  return (
    <OrderDetailCard
      order={order}
      variant="claimed"
      onAction={handleUpdateClaim}
      actionLabel="Update Claim Status"
    />
  )
}
