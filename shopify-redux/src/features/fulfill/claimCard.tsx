import { useDispatch } from 'react-redux'
import { Claim } from '../../app/utility/interfaces'
import { setUpdateClaimedOrder } from '../../services/userInterfaceSlice'
import { setUpdateClaimMode } from '../../services/dataSlice'
import { useOrderFileLoader } from '../../hooks/useOrderFileLoader'
import { OrderDetailCard } from '../shared/OrderDetailCard'

export const ClaimCard: React.FC<{ claim: Claim }> = ({ claim }) => {
  const dispatch = useDispatch()
  const { prepareOrderFile } = useOrderFileLoader()

  const handleUpdateClaim = async () => {
    await prepareOrderFile(claim.order)
    dispatch(setUpdateClaimMode({ updateClaimMode: true }))
    dispatch(setUpdateClaimedOrder({ updateClaimedOrder: claim }))
  }

  return (
    <OrderDetailCard
      order={claim.order}
      variant="claimed"
      onAction={handleUpdateClaim}
      actionLabel="Update Claim Status"
    />
  )
}
