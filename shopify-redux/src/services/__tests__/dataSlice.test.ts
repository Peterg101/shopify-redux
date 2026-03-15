import dataSliceReducer, {
  setSelectedFileType,
  setSelectedFile,
  resetDataState,
  setFileProperties,
  setFulfillFileViewProperties,
  setModelVolume,
  setQALevel,
  setProcessFamily,
  setToleranceMm,
  setSurfaceFinish,
  setStepMetadata,
  setFromMeshyOrHistory,
  setProcessId,
  setMaterialId,
} from '../dataSlice'
import { DataState, FileInformation, Order, StepMetadata } from '../../app/utility/interfaces'

const initialState: DataState = {
  taskId: '',
  modelColour: 'white',
  selectedFile: '',
  selectedFileType: '',
  printTechnique: 'FDM',
  printMaterial: 'PLA Basic',
  processId: null,
  materialId: null,
  processFamily: null,
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
  materialCost: 0.00005,
  qaLevel: 'standard',
  toleranceMm: undefined,
  surfaceFinish: undefined,
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
      expect(state.fileDisplay).toBe(true)
    })
  })

  describe('setModelVolume', () => {
    it('should set modelVolume', () => {
      const state = dataSliceReducer(initialState, setModelVolume({ modelVolume: 42.5 }))
      expect(state.modelVolume).toBe(42.5)
    })
  })

  describe('setQALevel', () => {
    it('should set qaLevel to high', () => {
      const state = dataSliceReducer(initialState, setQALevel({ qaLevel: 'high' }))
      expect(state.qaLevel).toBe('high')
    })

    it('should set qaLevel back to standard', () => {
      const highState = { ...initialState, qaLevel: 'high' as const }
      const state = dataSliceReducer(highState, setQALevel({ qaLevel: 'standard' }))
      expect(state.qaLevel).toBe('standard')
    })
  })

  describe('setProcessFamily', () => {
    it('should set processFamily to a string', () => {
      const state = dataSliceReducer(initialState, setProcessFamily({ processFamily: 'additive' }))
      expect(state.processFamily).toBe('additive')
    })

    it('should set processFamily to null', () => {
      const withFamily = { ...initialState, processFamily: 'cnc' }
      const state = dataSliceReducer(withFamily, setProcessFamily({ processFamily: null }))
      expect(state.processFamily).toBeNull()
    })
  })

  describe('setToleranceMm', () => {
    it('should set toleranceMm to a number', () => {
      const state = dataSliceReducer(initialState, setToleranceMm({ toleranceMm: 0.1 }))
      expect(state.toleranceMm).toBe(0.1)
    })

    it('should set toleranceMm to undefined', () => {
      const withTolerance = { ...initialState, toleranceMm: 0.05 }
      const state = dataSliceReducer(withTolerance, setToleranceMm({ toleranceMm: undefined }))
      expect(state.toleranceMm).toBeUndefined()
    })
  })

  describe('setSurfaceFinish', () => {
    it('should set surfaceFinish to a string', () => {
      const state = dataSliceReducer(initialState, setSurfaceFinish({ surfaceFinish: 'polished' }))
      expect(state.surfaceFinish).toBe('polished')
    })

    it('should set surfaceFinish to undefined', () => {
      const withFinish = { ...initialState, surfaceFinish: 'matte' }
      const state = dataSliceReducer(withFinish, setSurfaceFinish({ surfaceFinish: undefined }))
      expect(state.surfaceFinish).toBeUndefined()
    })
  })

  describe('setStepMetadata', () => {
    it('should set stepMetadata object', () => {
      const metadata: StepMetadata = {
        jobId: 'job-123',
        processingStatus: 'complete',
        progress: 100,
        previewUrl: 'https://example.com/preview.glb',
        boundingBox: { x: 10, y: 20, z: 30 },
        volumeMm3: 5000,
        surfaceAreaMm2: 1200,
      }
      const state = dataSliceReducer(initialState, setStepMetadata(metadata))
      expect(state.stepMetadata).toEqual(metadata)
      expect(state.stepMetadata!.jobId).toBe('job-123')
      expect(state.stepMetadata!.boundingBox).toEqual({ x: 10, y: 20, z: 30 })
    })
  })

  describe('setFromMeshyOrHistory', () => {
    it('should set fromMeshyOrHistory to true', () => {
      const state = dataSliceReducer(initialState, setFromMeshyOrHistory({ fromMeshyOrHistory: true }))
      expect(state.fromMeshyOrHistory).toBe(true)
    })

    it('should set fromMeshyOrHistory to false', () => {
      const activeState = { ...initialState, fromMeshyOrHistory: true }
      const state = dataSliceReducer(activeState, setFromMeshyOrHistory({ fromMeshyOrHistory: false }))
      expect(state.fromMeshyOrHistory).toBe(false)
    })
  })

  describe('setProcessId', () => {
    it('should set processId to a string', () => {
      const state = dataSliceReducer(initialState, setProcessId({ processId: 'proc-abc' }))
      expect(state.processId).toBe('proc-abc')
    })

    it('should set processId to null', () => {
      const withId = { ...initialState, processId: 'proc-abc' }
      const state = dataSliceReducer(withId, setProcessId({ processId: null }))
      expect(state.processId).toBeNull()
    })
  })

  describe('setMaterialId', () => {
    it('should set materialId to a string', () => {
      const state = dataSliceReducer(initialState, setMaterialId({ materialId: 'mat-xyz' }))
      expect(state.materialId).toBe('mat-xyz')
    })

    it('should set materialId to null', () => {
      const withId = { ...initialState, materialId: 'mat-xyz' }
      const state = dataSliceReducer(withId, setMaterialId({ materialId: null }))
      expect(state.materialId).toBeNull()
    })
  })
})
