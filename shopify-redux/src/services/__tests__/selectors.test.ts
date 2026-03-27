import { selectTotalCost, selectTotalBasketValue, selectVisibleOrders } from '../selectors'
import { RootState, rootInitialState } from '../../app/store'
import { createMockBasketInformation, createMockOrder, createMockSlimSession } from '../../test-utils/mockData'
import { authApi } from '../authApi'

// Helper to build a state with RTK Query cache for getUserBasket
function stateWithBasketCache(basketItems: ReturnType<typeof createMockBasketInformation>[]): RootState {
  const session = createMockSlimSession()
  const state = {
    ...rootInitialState,
    userInterfaceState: {
      ...rootInitialState.userInterfaceState,
      userInformation: session,
    },
    authApi: {
      ...rootInitialState.authApi,
      queries: {
        ...rootInitialState.authApi.queries,
        'getUserBasket(undefined)': {
          status: 'fulfilled' as const,
          data: basketItems,
          endpointName: 'getUserBasket',
          requestId: 'test',
          startedTimeStamp: Date.now(),
          fulfilledTimeStamp: Date.now(),
        },
      },
    },
  } as unknown as RootState
  return state
}

// Helper to build a state with RTK Query cache for getUserClaimable
function stateWithClaimableCache(
  userId: string,
  claimableOrders: ReturnType<typeof createMockOrder>[]
): RootState {
  const session = createMockSlimSession({
    user: { user_id: userId, username: 'test', email: 'test@test.com' },
  })
  const state = {
    ...rootInitialState,
    userInterfaceState: {
      ...rootInitialState.userInterfaceState,
      userInformation: session,
    },
    authApi: {
      ...rootInitialState.authApi,
      queries: {
        ...rootInitialState.authApi.queries,
        'getUserClaimable(undefined)': {
          status: 'fulfilled' as const,
          data: claimableOrders,
          endpointName: 'getUserClaimable',
          requestId: 'test',
          startedTimeStamp: Date.now(),
          fulfilledTimeStamp: Date.now(),
        },
      },
    },
  } as unknown as RootState
  return state
}

describe('selectTotalCost', () => {
  it('returns 0 when inputs are 0', () => {
    const state = {
      ...rootInitialState,
      dataState: {
        ...rootInitialState.dataState,
        modelVolume: 0,
        materialCost: 0,
        multiplierValue: 0,
      },
    } as RootState

    expect(selectTotalCost(state)).toBe(0)
  })

  it('returns a cost when inputs are positive', () => {
    const state = {
      ...rootInitialState,
      dataState: {
        ...rootInitialState.dataState,
        modelVolume: 1000,
        materialCost: 0.05,
        multiplierValue: 2,
      },
    } as RootState

    expect(selectTotalCost(state)).toBeGreaterThan(0)
  })

  it('is memoized - same input returns same reference', () => {
    const state = {
      ...rootInitialState,
      dataState: {
        ...rootInitialState.dataState,
        modelVolume: 500,
        materialCost: 0.05,
        multiplierValue: 1,
      },
    } as RootState

    const result1 = selectTotalCost(state)
    const result2 = selectTotalCost(state)
    expect(result1).toBe(result2)
  })
})

describe('selectTotalBasketValue', () => {
  it('returns 0 for no basket items', () => {
    const state = stateWithBasketCache([])
    expect(selectTotalBasketValue(state)).toBe(0)
  })

  it('sums basket item values', () => {
    const items = [
      createMockBasketInformation({ price: 10, quantity: 2 }),
      createMockBasketInformation({ price: 5, quantity: 3 }),
    ]
    const state = stateWithBasketCache(items)
    expect(selectTotalBasketValue(state)).toBe(35) // (2*10) + (3*5)
  })

  it('returns 0 when userInformation is null', () => {
    const state = {
      ...rootInitialState,
      userInterfaceState: {
        ...rootInitialState.userInterfaceState,
        userInformation: null,
      },
    } as RootState

    expect(selectTotalBasketValue(state)).toBe(0)
  })
})

describe('selectVisibleOrders', () => {
  it('returns empty array when userInformation is null', () => {
    const state = {
      ...rootInitialState,
      userInterfaceState: {
        ...rootInitialState.userInterfaceState,
        userInformation: null,
      },
    } as RootState

    expect(selectVisibleOrders(state)).toEqual([])
  })

  it('filters out fully claimed orders', () => {
    const state = stateWithClaimableCache('u1', [
      createMockOrder({ quantity: 2, quantity_claimed: 2, claims: [] }),
    ])
    expect(selectVisibleOrders(state)).toHaveLength(0)
  })

  it('returns orders that are claimable', () => {
    const state = stateWithClaimableCache('u1', [
      createMockOrder({ quantity: 5, quantity_claimed: 1, claims: [] }),
    ])
    expect(selectVisibleOrders(state)).toHaveLength(1)
  })

  it('is memoized - same input returns same reference', () => {
    const state = stateWithClaimableCache('u1', [
      createMockOrder({ quantity: 5, quantity_claimed: 0, claims: [] }),
    ])
    const result1 = selectVisibleOrders(state)
    const result2 = selectVisibleOrders(state)
    expect(result1).toBe(result2)
  })
})
