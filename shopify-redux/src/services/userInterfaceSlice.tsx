import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { UserInterfaceState, Order, Claim } from "../app/utility/interfaces";
import { authApi } from "./authApi";

const initialState: UserInterfaceState = {
    leftDrawerOpen: false,
    selectedComponent: '',
    userInformation: null,
    claimedOrder: null,
    selectedClaim: null,
    fulfillMode: false,
    updateClaimMode: false,
}

export const userInterfaceSlice = createSlice({
    name: "userInterfaceState",
    initialState,
    reducers: {
        // Legacy — kept for any remaining references during migration
        setLeftDrawerOpen: (state) => { state.leftDrawerOpen = !state.leftDrawerOpen },
        setLeftDrawerClosed: (state) => { state.leftDrawerOpen = false },
        setSelectedComponent: (state, action: PayloadAction<{selectedComponent: string}>) => {
            state.selectedComponent = action.payload.selectedComponent
        },
        setClaimedOrder: (state, action: PayloadAction<{claimedOrder: Order}>) => {
            state.claimedOrder = action.payload.claimedOrder
        },
        setSelectedClaim: (state, action: PayloadAction<{selectedClaim: Claim | null}>) => {
            state.selectedClaim = action.payload.selectedClaim
        },
        setFulfillMode: (state, action: PayloadAction<{fulfillMode: boolean}>) => {
            state.fulfillMode = action.payload.fulfillMode
        },
        setUpdateClaimMode: (state, action: PayloadAction<{updateClaimMode: boolean}>) => {
            state.updateClaimMode = action.payload.updateClaimMode
        },
        resetSidebar: (state) => {
            state.leftDrawerOpen = false;
            state.selectedComponent = '';
        },
        forceLogout: (state) => {
            state.userInformation = null;
        },
    },
    extraReducers: (builder) => {
        builder
          .addMatcher(
            authApi.endpoints.getSlimSession.matchFulfilled,
            (state, { payload }) => {
              state.userInformation = payload
            }
          )
          .addMatcher(
            authApi.endpoints.getSlimSession.matchRejected,
            (state) => {
                state.userInformation = null;
              }
          )
          .addMatcher(
            authApi.endpoints.logOut.matchFulfilled,
            (state) => {
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
    setClaimedOrder,
    setSelectedClaim,
    setFulfillMode,
    setUpdateClaimMode,
    resetSidebar,
    forceLogout
} = userInterfaceSlice.actions

export default userInterfaceSlice.reducer
