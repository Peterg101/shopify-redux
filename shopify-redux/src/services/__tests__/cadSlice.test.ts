import cadReducer, {
  setCadLoading,
  setCadLoadedPercentage,
  setCadPending,
  setCadError,
  setCadStatusMessage,
  setCadGenerationSettings,
  resetCadState,
} from '../cadSlice'
import { CadState } from '../../app/utility/interfaces'

const initialState: CadState = {
  cadLoading: false,
  cadLoadedPercentage: 0,
  cadPending: false,
  cadGenerationSettings: {
    max_iterations: 3,
    timeout_seconds: 30,
    target_units: 'mm',
  },
  cadError: null,
  cadStatusMessage: null,
}

describe('cadSlice', () => {
  it('returns initial state', () => {
    expect(cadReducer(undefined, { type: 'unknown' })).toEqual(initialState)
  })

  describe('setCadLoading', () => {
    it('sets cadLoading to true', () => {
      const state = cadReducer(initialState, setCadLoading({ cadLoading: true }))
      expect(state.cadLoading).toBe(true)
      expect(state.cadLoadedPercentage).toBe(0)
    })

    it('sets cadLoading to false and resets percentage and statusMessage', () => {
      const loadingState: CadState = {
        ...initialState,
        cadLoading: true,
        cadLoadedPercentage: 75,
        cadStatusMessage: 'Generating geometry...',
      }
      const state = cadReducer(loadingState, setCadLoading({ cadLoading: false }))
      expect(state.cadLoading).toBe(false)
      expect(state.cadLoadedPercentage).toBe(0)
      expect(state.cadStatusMessage).toBeNull()
    })
  })

  describe('setCadLoadedPercentage', () => {
    it('sets cadLoadedPercentage', () => {
      const state = cadReducer(
        initialState,
        setCadLoadedPercentage({ cadLoadedPercentage: 50 })
      )
      expect(state.cadLoadedPercentage).toBe(50)
    })
  })

  describe('setCadPending', () => {
    it('sets cadPending to true', () => {
      const state = cadReducer(initialState, setCadPending({ cadPending: true }))
      expect(state.cadPending).toBe(true)
    })

    it('sets cadPending to false', () => {
      const pendingState = { ...initialState, cadPending: true }
      const state = cadReducer(pendingState, setCadPending({ cadPending: false }))
      expect(state.cadPending).toBe(false)
    })
  })

  describe('setCadError', () => {
    it('sets cadError to an error message', () => {
      const state = cadReducer(
        initialState,
        setCadError({ cadError: 'CadQuery script failed' })
      )
      expect(state.cadError).toBe('CadQuery script failed')
    })

    it('clears cadError by setting to null', () => {
      const errorState = { ...initialState, cadError: 'Some error' }
      const state = cadReducer(errorState, setCadError({ cadError: null }))
      expect(state.cadError).toBeNull()
    })
  })

  describe('setCadStatusMessage', () => {
    it('sets cadStatusMessage', () => {
      const state = cadReducer(
        initialState,
        setCadStatusMessage({ cadStatusMessage: 'Validating STEP output...' })
      )
      expect(state.cadStatusMessage).toBe('Validating STEP output...')
    })

    it('clears cadStatusMessage by setting to null', () => {
      const withMessage = { ...initialState, cadStatusMessage: 'Processing...' }
      const state = cadReducer(
        withMessage,
        setCadStatusMessage({ cadStatusMessage: null })
      )
      expect(state.cadStatusMessage).toBeNull()
    })
  })

  describe('setCadGenerationSettings', () => {
    it('partially merges new settings', () => {
      const state = cadReducer(
        initialState,
        setCadGenerationSettings({ settings: { max_iterations: 5 } })
      )
      expect(state.cadGenerationSettings.max_iterations).toBe(5)
      expect(state.cadGenerationSettings.timeout_seconds).toBe(30)
      expect(state.cadGenerationSettings.target_units).toBe('mm')
    })

    it('can update multiple settings at once', () => {
      const state = cadReducer(
        initialState,
        setCadGenerationSettings({
          settings: { timeout_seconds: 60, target_units: 'inches' },
        })
      )
      expect(state.cadGenerationSettings.max_iterations).toBe(3)
      expect(state.cadGenerationSettings.timeout_seconds).toBe(60)
      expect(state.cadGenerationSettings.target_units).toBe('inches')
    })
  })

  describe('resetCadState', () => {
    it('resets all state to initial values', () => {
      const modifiedState: CadState = {
        cadLoading: true,
        cadLoadedPercentage: 80,
        cadPending: true,
        cadGenerationSettings: {
          max_iterations: 10,
          timeout_seconds: 120,
          target_units: 'inches',
        },
        cadError: 'some error',
        cadStatusMessage: 'processing',
      }
      const state = cadReducer(modifiedState, resetCadState())
      expect(state).toEqual(initialState)
    })
  })
})
