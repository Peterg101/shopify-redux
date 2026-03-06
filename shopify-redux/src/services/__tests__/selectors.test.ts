import { selectTotalCost, selectTotalBasketValue, selectVisibleOrders } from '../selectors'
import { RootState, rootInitialState } from '../../app/store'
import { createMockBasketInformation, createMockOrder } from '../../test-utils/mockData'

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
    const state = {
      ...rootInitialState,
      userInterfaceState: {
        ...rootInitialState.userInterfaceState,
        userInformation: {
          user: { user_id: 'u1', username: 'test', email: 'test@test.com' },
          tasks: [],
          basket_items: [],
          incomplete_task: null as any,
          orders: [],
          claimable_orders: [],
          claims: [],
        },
      },
    } as RootState

    expect(selectTotalBasketValue(state)).toBe(0)
  })

  it('sums basket item values', () => {
    const items = [
      createMockBasketInformation({ price: 10, quantity: 2 }),
      createMockBasketInformation({ price: 5, quantity: 3 }),
    ]

    const state = {
      ...rootInitialState,
      userInterfaceState: {
        ...rootInitialState.userInterfaceState,
        userInformation: {
          user: { user_id: 'u1', username: 'test', email: 'test@test.com' },
          tasks: [],
          basket_items: items,
          incomplete_task: null as any,
          orders: [],
          claimable_orders: [],
          claims: [],
        },
      },
    } as RootState

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
    const state = {
      ...rootInitialState,
      userInterfaceState: {
        ...rootInitialState.userInterfaceState,
        userInformation: {
          user: { user_id: 'u1', username: 'test', email: 'test@test.com' },
          tasks: [],
          basket_items: [],
          incomplete_task: null as any,
          orders: [],
          claimable_orders: [
            createMockOrder({ quantity: 2, quantity_claimed: 2, claims: [] }),
          ],
          claims: [],
        },
      },
    } as RootState

    expect(selectVisibleOrders(state)).toHaveLength(0)
  })

  it('returns orders that are claimable', () => {
    const state = {
      ...rootInitialState,
      userInterfaceState: {
        ...rootInitialState.userInterfaceState,
        userInformation: {
          user: { user_id: 'u1', username: 'test', email: 'test@test.com' },
          tasks: [],
          basket_items: [],
          incomplete_task: null as any,
          orders: [],
          claimable_orders: [
            createMockOrder({ quantity: 5, quantity_claimed: 1, claims: [] }),
          ],
          claims: [],
        },
      },
    } as RootState

    expect(selectVisibleOrders(state)).toHaveLength(1)
  })

  it('is memoized - same input returns same reference', () => {
    const state = {
      ...rootInitialState,
      userInterfaceState: {
        ...rootInitialState.userInterfaceState,
        userInformation: {
          user: { user_id: 'u1', username: 'test', email: 'test@test.com' },
          tasks: [],
          basket_items: [],
          incomplete_task: null as any,
          orders: [],
          claimable_orders: [
            createMockOrder({ quantity: 5, quantity_claimed: 0, claims: [] }),
          ],
          claims: [],
        },
      },
    } as RootState

    const result1 = selectVisibleOrders(state)
    const result2 = selectVisibleOrders(state)
    expect(result1).toBe(result2)
  })
})
