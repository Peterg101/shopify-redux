import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { UserInterfaceState, Order, Claim } from "../app/utility/interfaces";
import { authApi } from "./authApi";

const initialState: UserInterfaceState = {
    leftDrawerOpen: false,
    selectedComponent: '',
    isLoggedIn: false,
    userInformation: null,
    totalBasketValue: 0,
    claimedOrder: null,
    selectedClaim: null,
    fulfillMode: false,
    updateClaimMode: false,
}

export const userInterfaceSlice = createSlice({
    name: "userInterfaceState",
    initialState,
    reducers: {
        setLeftDrawerOpen: (state) => {
            state.leftDrawerOpen = !state.leftDrawerOpen
        },
        setLeftDrawerClosed: (state) => {
            state.leftDrawerOpen = false
        },
        setSelectedComponent: (state, action: PayloadAction<{selectedComponent: string}>) => {
            const {selectedComponent} = action.payload
            state.selectedComponent = selectedComponent
        },
        setTotalBasketCost: (state, action: PayloadAction<{totalBasketCost: number}>) => {
            const {totalBasketCost} = action.payload
            state.totalBasketValue = totalBasketCost
        },
        setClaimedOrder: (state, action: PayloadAction<{claimedOrder: Order}>) => {
            const {claimedOrder} = action.payload
            state.claimedOrder = claimedOrder
        },
        setSelectedClaim: (state, action: PayloadAction<{selectedClaim: Claim | null}>) => {
            state.selectedClaim = action.payload.selectedClaim
        },
        setFulfillMode: (state, action: PayloadAction<{fulfillMode: boolean}>) => {
            const {fulfillMode} = action.payload
            state.fulfillMode = fulfillMode
        },
        setUpdateClaimMode: (state, action: PayloadAction<{updateClaimMode: boolean}>) => {
            const {updateClaimMode} = action.payload
            state.updateClaimMode = updateClaimMode
        },
        resetSidebar: (state) => {
            state.leftDrawerOpen = false;
            state.selectedComponent = '';
        },
    },
    extraReducers: (builder) => {
        builder
          .addMatcher(
            authApi.endpoints.getSession.matchFulfilled,
            (state, { payload }) => {
              state.isLoggedIn = true;
              state.userInformation = payload
            }
          )
          .addMatcher(
            authApi.endpoints.getSession.matchRejected,
            (state, action) => {
                state.isLoggedIn = false;
                state.userInformation = null;
              }
          )
          .addMatcher(
            authApi.endpoints.logOut.matchFulfilled,
            (state, action) => {
                state.isLoggedIn = false;
                state.userInformation = null;
              }
          );
      },
}
)
export const {
    setLeftDrawerOpen,
    setLeftDrawerClosed,
    setSelectedComponent,
    setTotalBasketCost,
    setClaimedOrder,
    setSelectedClaim,
    setFulfillMode,
    setUpdateClaimMode,
    resetSidebar
} = userInterfaceSlice.actions

export default userInterfaceSlice.reducer
