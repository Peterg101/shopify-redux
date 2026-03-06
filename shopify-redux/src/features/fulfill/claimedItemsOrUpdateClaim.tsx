import { useSelector } from "react-redux"
import { RootState } from "../../app/store"
import { ClaimedItems } from "./claimedItems"
import { UpdateClaimStatus } from "./updateClaimStatus"

export const ClaimedItemsOrUpdateClaim = () => {
  const { updateClaimMode } = useSelector((state: RootState) => state.userInterfaceState);

  return updateClaimMode
    ? <UpdateClaimStatus />
    : <ClaimedItems />;
};