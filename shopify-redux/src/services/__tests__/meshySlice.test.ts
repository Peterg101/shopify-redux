import meshyReducer, {
  setMeshyLoading,
  setMeshyLoadedPercentage,
  setMeshyPending,
  setMeshyQueueItems,
  setMeshyGenerationSettings,
  resetMeshyGenerationSettings,
  setMeshyPreviewTaskId,
  setMeshyRefining,
  resetMeshyState,
} from '../meshySlice'
import { MeshyState } from '../../app/utility/interfaces'

const initialState: MeshyState = {
  meshyLoading: false,
  meshyLoadedPercentage: 0,
  meshyPending: false,
  meshyQueueItems: 0,
  meshyGenerationSettings: {
    ai_model: 'meshy-5',
    art_style: 'realistic',
    negative_prompt: 'low quality, low resolution, low poly, ugly',
    topology: 'triangle',
    target_polycount: 30000,
    symmetry_mode: 'auto',
    enable_pbr: true,
    should_remesh: true,
    should_texture: true,
    texture_prompt: '',
  },
  meshyPreviewTaskId: null,
  meshyRefining: false,
}

describe('meshySlice', () => {
  it('returns initial state', () => {
    expect(meshyReducer(undefined, { type: 'unknown' })).toEqual(initialState)
  })

  describe('setMeshyLoading', () => {
    it('sets meshyLoading to true', () => {
      const state = meshyReducer(initialState, setMeshyLoading({ meshyLoading: true }))
      expect(state.meshyLoading).toBe(true)
    })

    it('sets meshyLoading to false and resets percentage', () => {
      const loadingState: MeshyState = {
        ...initialState,
        meshyLoading: true,
        meshyLoadedPercentage: 60,
      }
      const state = meshyReducer(loadingState, setMeshyLoading({ meshyLoading: false }))
      expect(state.meshyLoading).toBe(false)
      expect(state.meshyLoadedPercentage).toBe(0)
    })
  })

  describe('setMeshyLoadedPercentage', () => {
    it('sets meshyLoadedPercentage', () => {
      const state = meshyReducer(
        initialState,
        setMeshyLoadedPercentage({ meshyLoadedPercentage: 45 })
      )
      expect(state.meshyLoadedPercentage).toBe(45)
    })
  })

  describe('setMeshyPending', () => {
    it('sets meshyPending to true', () => {
      const state = meshyReducer(initialState, setMeshyPending({ meshyPending: true }))
      expect(state.meshyPending).toBe(true)
    })

    it('sets meshyPending to false and resets queueItems', () => {
      const pendingState: MeshyState = {
        ...initialState,
        meshyPending: true,
        meshyQueueItems: 5,
      }
      const state = meshyReducer(pendingState, setMeshyPending({ meshyPending: false }))
      expect(state.meshyPending).toBe(false)
      expect(state.meshyQueueItems).toBe(0)
    })
  })

  describe('setMeshyQueueItems', () => {
    it('sets meshyQueueItems', () => {
      const state = meshyReducer(
        initialState,
        setMeshyQueueItems({ meshyQueueItems: 3 })
      )
      expect(state.meshyQueueItems).toBe(3)
    })
  })

  describe('setMeshyGenerationSettings', () => {
    it('partially merges new settings', () => {
      const state = meshyReducer(
        initialState,
        setMeshyGenerationSettings({ settings: { art_style: 'sculpture' } })
      )
      expect(state.meshyGenerationSettings.art_style).toBe('sculpture')
      expect(state.meshyGenerationSettings.ai_model).toBe('meshy-5')
      expect(state.meshyGenerationSettings.enable_pbr).toBe(true)
    })

    it('can update multiple settings at once', () => {
      const state = meshyReducer(
        initialState,
        setMeshyGenerationSettings({
          settings: {
            topology: 'quad',
            target_polycount: 50000,
            enable_pbr: false,
          },
        })
      )
      expect(state.meshyGenerationSettings.topology).toBe('quad')
      expect(state.meshyGenerationSettings.target_polycount).toBe(50000)
      expect(state.meshyGenerationSettings.enable_pbr).toBe(false)
      expect(state.meshyGenerationSettings.art_style).toBe('realistic')
    })
  })

  describe('resetMeshyGenerationSettings', () => {
    it('resets only generation settings to initial values, preserving other state', () => {
      const modifiedState: MeshyState = {
        ...initialState,
        meshyLoading: true,
        meshyLoadedPercentage: 50,
        meshyGenerationSettings: {
          ...initialState.meshyGenerationSettings,
          art_style: 'cartoon',
          topology: 'quad',
          target_polycount: 100000,
        },
      }
      const state = meshyReducer(modifiedState, resetMeshyGenerationSettings())
      expect(state.meshyGenerationSettings).toEqual(initialState.meshyGenerationSettings)
      expect(state.meshyLoading).toBe(true)
      expect(state.meshyLoadedPercentage).toBe(50)
    })
  })

  describe('setMeshyPreviewTaskId', () => {
    it('sets meshyPreviewTaskId to a string', () => {
      const state = meshyReducer(
        initialState,
        setMeshyPreviewTaskId({ meshyPreviewTaskId: 'task-abc-123' })
      )
      expect(state.meshyPreviewTaskId).toBe('task-abc-123')
    })

    it('sets meshyPreviewTaskId to null', () => {
      const withTaskId = { ...initialState, meshyPreviewTaskId: 'task-abc-123' }
      const state = meshyReducer(
        withTaskId,
        setMeshyPreviewTaskId({ meshyPreviewTaskId: null })
      )
      expect(state.meshyPreviewTaskId).toBeNull()
    })
  })

  describe('setMeshyRefining', () => {
    it('sets meshyRefining to true', () => {
      const state = meshyReducer(
        initialState,
        setMeshyRefining({ meshyRefining: true })
      )
      expect(state.meshyRefining).toBe(true)
    })

    it('sets meshyRefining to false', () => {
      const refiningState = { ...initialState, meshyRefining: true }
      const state = meshyReducer(
        refiningState,
        setMeshyRefining({ meshyRefining: false })
      )
      expect(state.meshyRefining).toBe(false)
    })
  })

  describe('resetMeshyState', () => {
    it('resets all state to initial values', () => {
      const modifiedState: MeshyState = {
        meshyLoading: true,
        meshyLoadedPercentage: 90,
        meshyPending: true,
        meshyQueueItems: 7,
        meshyGenerationSettings: {
          ai_model: 'meshy-3',
          art_style: 'cartoon',
          negative_prompt: 'blurry',
          topology: 'quad',
          target_polycount: 100000,
          symmetry_mode: 'on',
          enable_pbr: false,
          should_remesh: false,
          should_texture: false,
          texture_prompt: 'shiny metal',
        },
        meshyPreviewTaskId: 'some-task',
        meshyRefining: true,
      }
      const state = meshyReducer(modifiedState, resetMeshyState())
      expect(state).toEqual(initialState)
    })
  })
})
