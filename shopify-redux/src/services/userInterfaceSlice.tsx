import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { UserInterfaceState, Order, Claim } from "../app/utility/interfaces";
import { authApi } from "./authApi";

const initialState: UserInterfaceState = {
    leftDrawerOpen: false,
    drawerWidth: 400,
    selectedComponent: '',
    isLoggedIn: false,
    userInformation: null,
    totalBasketValue: 0,
    claimedOrder: null,
    updateClaimedOrder: null,
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
        setUpdateClaimedOrder: (state, action: PayloadAction<{updateClaimedOrder: Claim | null}>) => {
            const {updateClaimedOrder} = action.payload
            state.updateClaimedOrder = updateClaimedOrder
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
    setUpdateClaimedOrder,
    resetSidebar
} = userInterfaceSlice.actions

export default userInterfaceSlice.reducer
