import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { MeshyState, MeshyGenerationSettings } from "../app/utility/interfaces";

const initialState: MeshyState = {
    meshyLoading: false,
    meshyLoadedPercentage: 0,
    meshyPending: false,
    meshyQueueItems: 0,
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

export const meshySlice = createSlice({
    name: "meshyState",
    initialState,
    reducers: {
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
    },
})

export const {
    setMeshyLoading,
    setMeshyLoadedPercentage,
    setMeshyPending,
    setMeshyQueueItems,
    setMeshyGenerationSettings,
    resetMeshyGenerationSettings,
    setMeshyPreviewTaskId,
    setMeshyRefining,
} = meshySlice.actions

export default meshySlice.reducer
