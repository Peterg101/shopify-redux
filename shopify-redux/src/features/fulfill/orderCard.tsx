import { useDispatch } from 'react-redux'
import { Order } from '../../app/utility/interfaces'
import { setClaimedOrder } from '../../services/userInterfaceSlice'
import { useOrderFileLoader } from '../../hooks/useOrderFileLoader'
import { OrderDetailCard } from '../shared/OrderDetailCard'

export const OrderCard: React.FC<Order> = (order) => {
  const dispatch = useDispatch()
  const { prepareOrderFile } = useOrderFileLoader()

  const handleClaim = async (order: Order) => {
    await prepareOrderFile(order)
    dispatch(setClaimedOrder({ claimedOrder: order }))
  }

  const isClaimable = order.quantity !== order.quantity_claimed

  if (!isClaimable) return null

  return (
    <OrderDetailCard
      order={order}
      variant="claimable"
      onAction={handleClaim}
      actionLabel="Claim"
    />
  )
}
