import userInterfaceReducer, {
  setLeftDrawerOpen,
  setLeftDrawerClosed,
  setSelectedComponent,
} from '../userInterfaceSlice'
import { UserInterfaceState } from '../../app/utility/interfaces'

const initialState: UserInterfaceState = {
  leftDrawerOpen: false,
  drawerWidth: 400,
  selectedComponent: '',
  isLoggedIn: false,
  userInformation: null,
  totalBasketValue: 0,
  claimedOrder: null as any,
  updateClaimedOrder: null as any,
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
})
