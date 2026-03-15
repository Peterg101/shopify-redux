import userInterfaceReducer, {
  setLeftDrawerOpen,
  setLeftDrawerClosed,
  setSelectedComponent,
  setClaimedOrder,
  setSelectedClaim,
  setFulfillMode,
  setUpdateClaimMode,
  resetSidebar,
} from '../userInterfaceSlice'
import { UserInterfaceState } from '../../app/utility/interfaces'
import { createMockOrder, createMockClaim } from '../../test-utils/mockData'

const initialState: UserInterfaceState = {
  leftDrawerOpen: false,
  selectedComponent: '',
  userInformation: null,
  claimedOrder: null as any,
  selectedClaim: null as any,
  fulfillMode: false,
  updateClaimMode: false,
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

  describe('selected component', () => {
    it('sets selected component', () => {
      const state = userInterfaceReducer(
        initialState,
        setSelectedComponent({ selectedComponent: 'basket' })
      )
      expect(state.selectedComponent).toBe('basket')
    })
  })

  describe('setClaimedOrder', () => {
    it('sets claimedOrder from an Order object', () => {
      const order = createMockOrder({ name: 'Claimed Widget' })
      const state = userInterfaceReducer(
        initialState,
        setClaimedOrder({ claimedOrder: order })
      )
      expect(state.claimedOrder).toEqual(order)
      expect(state.claimedOrder.name).toBe('Claimed Widget')
    })
  })

  describe('setSelectedClaim', () => {
    it('sets selectedClaim from a Claim object', () => {
      const claim = createMockClaim({ status: 'in_progress' })
      const state = userInterfaceReducer(
        initialState,
        setSelectedClaim({ selectedClaim: claim })
      )
      expect(state.selectedClaim).toEqual(claim)
      expect(state.selectedClaim!.status).toBe('in_progress')
    })

    it('sets selectedClaim to null', () => {
      const claim = createMockClaim()
      const stateWithClaim = userInterfaceReducer(
        initialState,
        setSelectedClaim({ selectedClaim: claim })
      )
      expect(stateWithClaim.selectedClaim).not.toBeNull()

      const state = userInterfaceReducer(
        stateWithClaim,
        setSelectedClaim({ selectedClaim: null })
      )
      expect(state.selectedClaim).toBeNull()
    })
  })

  describe('setFulfillMode', () => {
    it('sets fulfillMode to true', () => {
      const state = userInterfaceReducer(
        initialState,
        setFulfillMode({ fulfillMode: true })
      )
      expect(state.fulfillMode).toBe(true)
    })

    it('sets fulfillMode to false', () => {
      const activeState = { ...initialState, fulfillMode: true }
      const state = userInterfaceReducer(
        activeState,
        setFulfillMode({ fulfillMode: false })
      )
      expect(state.fulfillMode).toBe(false)
    })
  })

  describe('setUpdateClaimMode', () => {
    it('sets updateClaimMode to true', () => {
      const state = userInterfaceReducer(
        initialState,
        setUpdateClaimMode({ updateClaimMode: true })
      )
      expect(state.updateClaimMode).toBe(true)
    })

    it('sets updateClaimMode to false', () => {
      const activeState = { ...initialState, updateClaimMode: true }
      const state = userInterfaceReducer(
        activeState,
        setUpdateClaimMode({ updateClaimMode: false })
      )
      expect(state.updateClaimMode).toBe(false)
    })
  })

  describe('resetSidebar', () => {
    it('resets leftDrawerOpen and selectedComponent to defaults', () => {
      const modifiedState: UserInterfaceState = {
        ...initialState,
        leftDrawerOpen: true,
        selectedComponent: 'basket',
        fulfillMode: true,
      }
      const state = userInterfaceReducer(modifiedState, resetSidebar())
      expect(state.leftDrawerOpen).toBe(false)
      expect(state.selectedComponent).toBe('')
    })

    it('does not reset other state properties', () => {
      const modifiedState: UserInterfaceState = {
        ...initialState,
        leftDrawerOpen: true,
        selectedComponent: 'orders',
        fulfillMode: true,
        updateClaimMode: true,
      }
      const state = userInterfaceReducer(modifiedState, resetSidebar())
      expect(state.fulfillMode).toBe(true)
      expect(state.updateClaimMode).toBe(true)
    })
  })
})
