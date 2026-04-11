import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { CadState, CadGenerationSettings } from "../app/utility/interfaces";

const initialState: CadState = {
    cadLoading: false,
    cadLoadedPercentage: 0,
    cadPending: false,
    cadGenerationSettings: {
        max_iterations: 3,
        timeout_seconds: 30,
        target_units: 'mm',
        process: 'fdm',
        approximate_size: null,
        material_hint: 'plastic',
        features: [],
    },
    cadError: null,
    cadStatusMessage: null,
    cadOperationType: null as string | null,
}

export const cadSlice = createSlice({
    name: "cadState",
    initialState,
    reducers: {
        setCadLoading: (state, action: PayloadAction<{cadLoading: boolean}>) => {
            state.cadLoading = action.payload.cadLoading
            if (!action.payload.cadLoading) {
                state.cadLoadedPercentage = 0
                state.cadStatusMessage = null
            }
        },
        setCadLoadedPercentage: (state, action: PayloadAction<{cadLoadedPercentage: number}>) => {
            state.cadLoadedPercentage = action.payload.cadLoadedPercentage
        },
        setCadPending: (state, action: PayloadAction<{cadPending: boolean}>) => {
            state.cadPending = action.payload.cadPending
        },
        setCadError: (state, action: PayloadAction<{cadError: string | null}>) => {
            state.cadError = action.payload.cadError
        },
        setCadStatusMessage: (state, action: PayloadAction<{cadStatusMessage: string | null}>) => {
            state.cadStatusMessage = action.payload.cadStatusMessage
        },
        setCadGenerationSettings: (state, action: PayloadAction<{settings: Partial<CadGenerationSettings>}>) => {
            state.cadGenerationSettings = { ...state.cadGenerationSettings, ...action.payload.settings };
        },
        setCadOperationType: (state, action: PayloadAction<{cadOperationType: string | null}>) => {
            state.cadOperationType = action.payload.cadOperationType
        },
        resetCadState: () => initialState,
    },
})

export const {
    setCadLoading,
    setCadLoadedPercentage,
    setCadPending,
    setCadError,
    setCadStatusMessage,
    setCadGenerationSettings,
    setCadOperationType,
    resetCadState,
} = cadSlice.actions

export default cadSlice.reducer
