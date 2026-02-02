import { useSelector } from "react-redux"
import { RootState } from "../../app/store"
import { ClaimedItems } from "./claimedItems"
import { UpdateClaimStatus } from "./updateClaimStatus"

export const ClaimedItemsOrUpdateClaim = () => {
  const dataState = useSelector((state: RootState) => state.dataState);

  return dataState.updateClaimMode
    ? <UpdateClaimStatus />
    : <ClaimedItems />;
};