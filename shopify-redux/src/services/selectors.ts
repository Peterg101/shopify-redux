import { createSelector } from '@reduxjs/toolkit'
import { RootState } from '../app/store'
import { recalculateTotalCost, calculateTotalBasketValue, visibleOrders } from '../app/utility/utils'

const selectDataState = (state: RootState) => state.dataState

export const selectTotalCost = createSelector(
  [
    (state: RootState) => selectDataState(state).modelVolume,
    (state: RootState) => selectDataState(state).materialCost,
    (state: RootState) => selectDataState(state).multiplierValue,
  ],
  (modelVolume, materialCost, multiplierValue) =>
    recalculateTotalCost({ modelVolume, materialCost, multiplierValue })
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
