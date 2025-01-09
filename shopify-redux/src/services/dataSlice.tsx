import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { BasketInformation, BasketItem, DataState, FileInformation, VectorState } from "../app/utility/interfaces";
import * as THREE from "three";
import { getMidPoint } from "../app/utility/utils";

const initialVectorState: VectorState = {
    position: { x: 0, y: 0, z: 0 },
}

const initialState: DataState = {
    taskId:'',
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
    modelDimensions: initialVectorState,
    fileDisplay: false,
    xFlip: 0,
    yFlip: 0,
    zFlip: 0
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
        resetDataState: () => initialState,
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
            state.fileDisplay= true
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
        },
        setMultiplierMidpoint: (state) => {
            const midpoint = getMidPoint(state.minScale, state.maxScale)
            state.multiplierValue = midpoint
            
            
        },
        setModelDimensions: (
            state,
            action: PayloadAction<{
                modelDimensions: THREE.Vector3
            }>
        ) => {
            const {modelDimensions} = action.payload
            const serializedVector = {x: modelDimensions.x, y: modelDimensions.y, z: modelDimensions.z}
            state.modelDimensions.position = serializedVector
        },
        setUploadedFileEditProperties: (
            state,
            action: PayloadAction<{
                basketItem: BasketInformation,
                fileInformation: FileInformation
            }>
        ) => {
            const {basketItem, fileInformation} = action.payload
            state.taskId = basketItem.task_id
            state.fileNameBoxValue = basketItem.name
            state.printMaterial = basketItem.material
            state.printTechnique = basketItem.technique
            state.multiplierValue = basketItem.sizing
            state.modelColour = basketItem.colour
            state.selectedFile= fileInformation.fileUrl
            state.selectedFileType=basketItem.selectedFileType
            state.fileDisplay = true
        },
        setXFLip: (state, action: PayloadAction<{xFlip: number}>) => {
            const {xFlip} = action.payload
            state.xFlip = xFlip
         },
         setYFLip: (state, action: PayloadAction<{yFlip: number}>) => {
            const {yFlip} = action.payload
            state.yFlip = yFlip
         },
         setZFLip: (state, action: PayloadAction<{zFlip: number}>) => {
            const {zFlip} = action.payload
            state.zFlip = zFlip
         },

        
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
    setScales,
    setModelDimensions,
    setUploadedFileEditProperties,
    setMultiplierMidpoint,
    setXFLip,
    setYFLip,
    setZFLip
 } = dataSlice.actions

export default dataSlice.reducer