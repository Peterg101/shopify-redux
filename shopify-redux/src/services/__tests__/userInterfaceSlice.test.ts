import userInterfaceReducer, {
  setLeftDrawerOpen,
  setRightDrawerOpen,
  setLeftDrawerClosed,
  setRightDrawerClosed,
  setBasketItems,
  clearBasketItems,
  deleteBasketItem,
  setMeshyLoading,
  setSelectedComponent,
} from '../userInterfaceSlice'
import { UserInterfaceState } from '../../app/utility/interfaces'
import { createMockBasketItem } from '../../test-utils/mockData'
import { UUID } from 'crypto'

const initialState: UserInterfaceState = {
  leftDrawerOpen: false,
  rightDrawerOpen: false,
  basketItems: [],
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
    it('toggles left drawer and closes right', () => {
      const stateWithRight = { ...initialState, rightDrawerOpen: true }
      const state = userInterfaceReducer(stateWithRight, setLeftDrawerOpen())
      expect(state.leftDrawerOpen).toBe(true)
      expect(state.rightDrawerOpen).toBe(false)
    })

    it('toggles right drawer and closes left', () => {
      const stateWithLeft = { ...initialState, leftDrawerOpen: true }
      const state = userInterfaceReducer(stateWithLeft, setRightDrawerOpen())
      expect(state.rightDrawerOpen).toBe(true)
      expect(state.leftDrawerOpen).toBe(false)
    })

    it('closes left drawer', () => {
      const openState = { ...initialState, leftDrawerOpen: true }
      const state = userInterfaceReducer(openState, setLeftDrawerClosed())
      expect(state.leftDrawerOpen).toBe(false)
    })

    it('closes right drawer', () => {
      const openState = { ...initialState, rightDrawerOpen: true }
      const state = userInterfaceReducer(openState, setRightDrawerClosed())
      expect(state.rightDrawerOpen).toBe(false)
    })
  })

  describe('basket operations', () => {
    it('adds a basket item', () => {
      const item = createMockBasketItem({ id: 'a-b-c-d-e' })
      const state = userInterfaceReducer(initialState, setBasketItems({ newBasketItem: item }))
      expect(state.basketItems).toHaveLength(1)
      expect(state.basketItems[0].name).toBe('Test Item')
    })

    it('clears all basket items', () => {
      const stateWithItems = {
        ...initialState,
        basketItems: [createMockBasketItem()],
      }
      const state = userInterfaceReducer(stateWithItems, clearBasketItems())
      expect(state.basketItems).toHaveLength(0)
    })

    it('deletes a specific basket item', () => {
      const item = createMockBasketItem({ id: 'del-me-a-b-c' })
      const stateWithItems = { ...initialState, basketItems: [item] }
      const state = userInterfaceReducer(
        stateWithItems,
        deleteBasketItem({ uuidToDelete: 'del-me-a-b-c' as UUID })
      )
      expect(state.basketItems).toHaveLength(0)
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
