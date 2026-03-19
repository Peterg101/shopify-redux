import { createSelector } from '@reduxjs/toolkit'
import { RootState } from '../app/store'
import { recalculateTotalCost, calculateTotalBasketValue, visibleOrders } from '../app/utility/utils'

const selectDataState = (state: RootState) => state.dataState

export const selectIsLoggedIn = (state: RootState) => state.userInterfaceState.userInformation !== null

// Property-level selectors — prevent whole-slice subscriptions
export const selectUserInformation = (state: RootState) => state.userInterfaceState.userInformation
export const selectSelectedClaim = (state: RootState) => state.userInterfaceState.selectedClaim
export const selectLeftDrawerOpen = (state: RootState) => state.userInterfaceState.leftDrawerOpen
export const selectSelectedComponent = (state: RootState) => state.userInterfaceState.selectedComponent
export const selectFulfillMode = (state: RootState) => state.userInterfaceState.fulfillMode
export const selectUpdateClaimMode = (state: RootState) => state.userInterfaceState.updateClaimMode

export const selectTotalCost = createSelector(
  [
    (state: RootState) => selectDataState(state).modelVolume,
    (state: RootState) => selectDataState(state).materialCost,
    (state: RootState) => selectDataState(state).multiplierValue,
    (state: RootState) => selectDataState(state).processFamily,
  ],
  (modelVolume, materialCost, multiplierValue, processFamily) =>
    recalculateTotalCost({ modelVolume, materialCost, multiplierValue, processFamily })
)

export const selectTotalBasketValue = createSelector(
  [(state: RootState) => state.userInterfaceState.userInformation?.basket_items ?? []],
  (basketItems) => calculateTotalBasketValue(basketItems)
)

export const selectVisibleOrders = createSelector(
  [
    (state: RootState) => state.userInterfaceState.userInformation?.user ?? null,
    (state: RootState) => state.userInterfaceState.userInformation?.claimable_orders ?? [],
  ],
  (user, claimableOrders) => {
    if (!user) return []
    return visibleOrders(user, claimableOrders)
  }
)
