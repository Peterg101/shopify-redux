import userInterfaceReducer, {
  setLeftDrawerOpen,
  setLeftDrawerClosed,
  setMeshyLoading,
  setSelectedComponent,
} from '../userInterfaceSlice'
import { UserInterfaceState } from '../../app/utility/interfaces'

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
  claimedOrder: null as any,
  updateClaimedOrder: null as any,
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

describe('userInterfaceSlice', () => {
  it('returns initial state', () => {
    expect(userInterfaceReducer(undefined, { type: 'unknown' })).toEqual(initialState)
  })

  describe('drawer toggles', () => {
    it('toggles left drawer', () => {
      const state = userInterfaceReducer(initialState, setLeftDrawerOpen())
      expect(state.leftDrawerOpen).toBe(true)
    })

    it('closes left drawer', () => {
      const openState = { ...initialState, leftDrawerOpen: true }
      const state = userInterfaceReducer(openState, setLeftDrawerClosed())
      expect(state.leftDrawerOpen).toBe(false)
    })
  })

  describe('meshy state', () => {
    it('sets meshy loading and resets percentage when false', () => {
      const loadingState = { ...initialState, meshyLoading: true, meshyLoadedPercentage: 50 }
      const state = userInterfaceReducer(loadingState, setMeshyLoading({ meshyLoading: false }))
      expect(state.meshyLoading).toBe(false)
      expect(state.meshyLoadedPercentage).toBe(0)
    })
  })

  describe('selected component', () => {
    it('sets selected component', () => {
      const state = userInterfaceReducer(
        initialState,
        setSelectedComponent({ selectedComponent: 'basket' })
      )
      expect(state.selectedComponent).toBe('basket')
    })
  })
})
