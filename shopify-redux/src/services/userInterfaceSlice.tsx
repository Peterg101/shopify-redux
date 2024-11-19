import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { UserInterfaceState, BasketItem, UploadedFile } from "../app/utility/interfaces";
import { UUID } from "crypto";


const initialState: UserInterfaceState = {
    leftDrawerOpen: false,
    rightDrawerOpen: false,
    basketItems: [],
    drawerWidth: 400,
    meshyLoading: false,
    meshyLoadedPercentage: 0,
    meshyPending: false,
    meshyQueueItems: 0
}

export const userInterfaceSlice = createSlice({
    name: "userInterfaceState",
    initialState,
    reducers: {
        setLeftDrawerOpen: (state) => {
            const newLeftDrawerState = !state.leftDrawerOpen
            state.leftDrawerOpen = newLeftDrawerState
            state.rightDrawerOpen = false
        },
        setRightDrawerOpen: (state) => {
            const newRightDrawerState = !state.rightDrawerOpen
            state.rightDrawerOpen = newRightDrawerState
            state.leftDrawerOpen = false
        },
        setLeftDrawerClosed: (state) => {
            state.leftDrawerOpen = false
        },
        setRightDrawerClosed: (state) => {
            
            state.rightDrawerOpen = false
        },
        setBasketItems: (state, action: PayloadAction<{newBasketItem: BasketItem}>) => {
            const {newBasketItem} = action.payload
            const newBasketItems = state.basketItems.concat(newBasketItem)
            state.basketItems = newBasketItems
        },
        setAllBasketItems: (state, action: PayloadAction<{newBasketItems: BasketItem[]}>) => {
            const {newBasketItems} = action.payload
            state.basketItems = newBasketItems
        },
        clearBasketItems: (state) => {
            state.basketItems = []
        },
        deleteBasketItem: (state, action: PayloadAction<{uuidToDelete: UUID}>) => {
            const {uuidToDelete} = action.payload
            const updatedList = state.basketItems.filter(item => item.id !== uuidToDelete);
            state.basketItems = updatedList
        },
        setMeshyLoading: (state, action: PayloadAction<{meshyLoading: boolean}>) => {
            const {meshyLoading} = action.payload
            state.meshyLoading = meshyLoading

            if(meshyLoading === false){
                state.meshyLoadedPercentage = 0
            }
        },
        setMeshyLoadedPercentage: (state, action: PayloadAction<{meshyLoadedPercentage: number}>) => {
            const {meshyLoadedPercentage} = action.payload
            state.meshyLoadedPercentage = meshyLoadedPercentage
        },
        setMeshyPending: (state, action: PayloadAction<{meshyPending: boolean}>) => {
            const {meshyPending} = action.payload
            state.meshyPending = meshyPending

            if(meshyPending === false){
                state.meshyQueueItems = 0
            }
        },
        setMeshyQueueItems: (state, action: PayloadAction<{meshyQueueItems: number}>) => {
            const {meshyQueueItems} = action.payload
            state.meshyQueueItems = meshyQueueItems
        },

    }
}
)
export const {
    setLeftDrawerOpen,
    setRightDrawerOpen,
    setLeftDrawerClosed,
    setRightDrawerClosed,
    setBasketItems,
    setAllBasketItems,
    clearBasketItems,
    deleteBasketItem,
    setMeshyLoading,
    setMeshyLoadedPercentage,
    setMeshyPending,
    setMeshyQueueItems
} = userInterfaceSlice.actions

export default userInterfaceSlice.reducer