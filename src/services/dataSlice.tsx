import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DataState } from "../app/utility/interfaces";

const initialState: DataState = {
    modelColour: 'white',
    selectedFile: '',
    selectedFileType: '',
    printTechnique: '',
    printMaterial: '',
    modelVolume: 0,
    multiplierValue: 1,
    maxScale: 10,
    minScale: 0.1,
    fileNameBoxValue: '',
    modelDimensions: null
}

export const dataSlice = createSlice({
    name: "dataState",
    initialState,
    reducers: {
        setModelColour: (state, action: PayloadAction<{modelColour: string}>) => {
            const {modelColour} = action.payload
            state.modelColour = modelColour
        },
        setSelectedFile: (state, action: PayloadAction<{selectedFile: string}>) => {
            const {selectedFile} = action.payload
            state.selectedFile = selectedFile
        },
        setSelectedFileType: (state, action: PayloadAction<{selectedFileType: string}>) => {
            const {selectedFileType} = action.payload
            state.selectedFile = selectedFileType
        },
        setPrintTechnique: (state, action: PayloadAction<{printTechnique: string}>) => {
            const {printTechnique} = action.payload
            state.printTechnique = printTechnique
        },
        setPrintMaterial: (state, action: PayloadAction<{printMaterial: string}>) => {
            const {printMaterial} = action.payload
            state.printMaterial = printMaterial
        },
        setModelVolume: (state, action: PayloadAction<{modelVolume: number}>) => {
            const {modelVolume} = action.payload
            state.modelVolume = modelVolume
        },
        setMultiplierValue: (state, action: PayloadAction<{multiplierValue: number}>) => {
            const {multiplierValue} = action.payload
            state.multiplierValue = multiplierValue
        },
        setMaxScale: (state, action: PayloadAction<{maxScale: number}>) => {
            const {maxScale} = action.payload
            state.maxScale = maxScale
        },
        setMinScale: (state, action: PayloadAction<{minScale: number}>) => {
            const {minScale} = action.payload
            state.minScale = minScale
        },
        setFileNameBoxValue: (state, action: PayloadAction<{fileNameBoxValue: string}>) => {
            const {fileNameBoxValue} = action.payload
            state.fileNameBoxValue = fileNameBoxValue
        },
        resetDataState: (state) => {
            state = initialState
        },
        setFileProperties: (
            state, 
            action: PayloadAction<{
                fileNameBoxValue: string, 
                selectedFile: string, 
                selectedFileType: string}>) => 
        {
            const {
                fileNameBoxValue,
                selectedFile,
                selectedFileType
            } = action.payload

            state.fileNameBoxValue = fileNameBoxValue
            state.selectedFile = selectedFile
            state.selectedFileType = selectedFileType
        },
        setScales: (
            state,
            action: PayloadAction<{
                minScale: number,
                maxScale: number
            }>
        ) => {
            const {minScale, maxScale} = action.payload
            state.minScale = minScale
            state.maxScale = maxScale
        }
    }
})

export const { 
    setModelColour,
    setModelVolume,
    setSelectedFile,
    setFileNameBoxValue,
    setMaxScale,
    setMinScale,
    setMultiplierValue,
    setPrintMaterial,
    setPrintTechnique,
    setSelectedFileType,
    resetDataState,
    setFileProperties,
    setScales
 } = dataSlice.actions

export default dataSlice.reducer