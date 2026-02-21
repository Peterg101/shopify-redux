import dataSliceReducer, {
  setSelectedFileType,
  setSelectedFile,
  resetDataState,
  setFileProperties,
  setFulfillFileViewProperties,
} from '../dataSlice'
import { DataState, FileInformation, Order } from '../../app/utility/interfaces'

const initialState: DataState = {
  taskId: '',
  modelColour: 'white',
  selectedFile: '',
  selectedFileType: '',
  printTechnique: 'FDM',
  printMaterial: 'PLA Basic',
  modelVolume: 0,
  multiplierValue: 1,
  maxScale: 10,
  minScale: 0.1,
  fileNameBoxValue: '',
  modelDimensions: { position: { x: 0, y: 0, z: 0 } },
  fileDisplay: false,
  fromMeshyOrHistory: false,
  xFlip: 0,
  yFlip: 0,
  zFlip: 0,
  displayObjectConfig: false,
  materialCost: 0.00005,
  totalCost: 0,
  fulfillMode: false,
  updateClaimMode: false,
}

describe('dataSlice', () => {
  it('should return the initial state', () => {
    expect(dataSliceReducer(undefined, { type: 'unknown' })).toEqual(initialState)
  })

  describe('setSelectedFileType (bug fix)', () => {
    it('should set selectedFileType, NOT selectedFile', () => {
      const state = dataSliceReducer(initialState, setSelectedFileType({ selectedFileType: 'stl' }))
      expect(state.selectedFileType).toBe('stl')
      expect(state.selectedFile).toBe('')
    })

    it('should not mutate selectedFile when setting file type', () => {
      const stateWithFile = { ...initialState, selectedFile: 'my-model.stl' }
      const state = dataSliceReducer(stateWithFile, setSelectedFileType({ selectedFileType: 'obj' }))
      expect(state.selectedFileType).toBe('obj')
      expect(state.selectedFile).toBe('my-model.stl')
    })
  })

  describe('setSelectedFile', () => {
    it('should set selectedFile only', () => {
      const state = dataSliceReducer(initialState, setSelectedFile({ selectedFile: 'blob://file' }))
      expect(state.selectedFile).toBe('blob://file')
      expect(state.selectedFileType).toBe('')
    })
  })

  describe('resetDataState', () => {
    it('should reset to initial state', () => {
      const modifiedState = {
        ...initialState,
        selectedFile: 'some-file',
        selectedFileType: 'stl',
        modelColour: 'red',
        totalCost: 100,
      }
      const state = dataSliceReducer(modifiedState, resetDataState())
      expect(state).toEqual(initialState)
    })
  })

  describe('setFileProperties', () => {
    it('should set file name, file, type, and toggle display flags', () => {
      const state = dataSliceReducer(
        initialState,
        setFileProperties({
          fileNameBoxValue: 'model.stl',
          selectedFile: 'blob://file',
          selectedFileType: 'stl',
        })
      )
      expect(state.fileNameBoxValue).toBe('model.stl')
      expect(state.selectedFile).toBe('blob://file')
      expect(state.selectedFileType).toBe('stl')
      expect(state.fileDisplay).toBe(true)
      expect(state.displayObjectConfig).toBe(true)
    })
  })

  describe('setFulfillFileViewProperties', () => {
    it('should populate state from order and file info', () => {
      const order: Order = {
        order_id: 'order-1',
        user_id: 'user-1',
        task_id: 'task-1',
        name: 'Fulfill Model',
        material: 'PLA Basic',
        technique: 'FDM',
        sizing: 2,
        colour: 'blue',
        selectedFile: 'model.stl',
        selectedFileType: 'stl',
        price: 50,
        quantity: 3,
        quantity_claimed: 0,
        created_at: '2025-01-01',
        is_collaborative: true,
        status: 'open',
      }
      const fileInfo: FileInformation = {
        file: new File([], 'model.stl'),
        fileBlob: new Blob(),
        fileUrl: 'blob://fulfill-file',
      }
      const state = dataSliceReducer(
        initialState,
        setFulfillFileViewProperties({ order, fileInformation: fileInfo })
      )
      expect(state.taskId).toBe('task-1')
      expect(state.fileNameBoxValue).toBe('Fulfill Model')
      expect(state.printMaterial).toBe('PLA Basic')
      expect(state.multiplierValue).toBe(2)
      expect(state.modelColour).toBe('blue')
      expect(state.selectedFile).toBe('blob://fulfill-file')
      expect(state.selectedFileType).toBe('stl')
      expect(state.fulfillMode).toBe(true)
      expect(state.fileDisplay).toBe(true)
    })
  })
})
