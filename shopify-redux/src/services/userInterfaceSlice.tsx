import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { UserInterfaceState, Order, Claim, MeshyGenerationSettings } from "../app/utility/interfaces";
import { authApi } from "./authApi";

const initialState: UserInterfaceState = {
    leftDrawerOpen: false,
    drawerWidth: 400,
    selectedComponent: '',
    meshyLoading: false,
    meshyLoadedPercentage: 0,
    meshyPending: false,
    meshyQueueItems: 0,
    isLoggedIn: false,
    userInformation: null,
    totalBasketValue: 0,
    claimedOrder: null,
    updateClaimedOrder: null,
    meshyGenerationSettings: {
        ai_model: 'meshy-5',
        art_style: 'realistic',
        negative_prompt: 'low quality, low resolution, low poly, ugly',
        topology: 'triangle' as const,
        target_polycount: 30000,
        symmetry_mode: 'auto' as const,
        enable_pbr: true,
        should_remesh: true,
        should_texture: true,
        texture_prompt: '',
    },
    meshyPreviewTaskId: null,
    meshyRefining: false,
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
        setMeshyGenerationSettings: (state, action: PayloadAction<{settings: Partial<MeshyGenerationSettings>}>) => {
            state.meshyGenerationSettings = { ...state.meshyGenerationSettings, ...action.payload.settings };
        },
        resetMeshyGenerationSettings: (state) => {
            state.meshyGenerationSettings = initialState.meshyGenerationSettings;
        },
        setMeshyPreviewTaskId: (state, action: PayloadAction<{meshyPreviewTaskId: string | null}>) => {
            state.meshyPreviewTaskId = action.payload.meshyPreviewTaskId;
        },
        setMeshyRefining: (state, action: PayloadAction<{meshyRefining: boolean}>) => {
            state.meshyRefining = action.payload.meshyRefining;
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
    setMeshyLoading,
    setMeshyLoadedPercentage,
    setMeshyPending,
    setMeshyQueueItems,
    setSelectedComponent,
    setTotalBasketCost,
    setClaimedOrder,
    setUpdateClaimedOrder,
    setMeshyGenerationSettings,
    resetMeshyGenerationSettings,
    setMeshyPreviewTaskId,
    setMeshyRefining,
    resetSidebar
} = userInterfaceSlice.actions

export default userInterfaceSlice.reducer