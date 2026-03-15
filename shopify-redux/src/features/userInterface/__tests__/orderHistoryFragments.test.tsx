import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { EmptyOrderHistory, OrderHistory, OrderList } from '../orderHistoryFragments'
import { createMockOrder, createMockClaim, createMockSessionData } from '../../../test-utils/mockData'

// Mock the visibility mutation to avoid RTK Query side effects
jest.mock('../../../services/dbApi', () => ({
  ...jest.requireActual('../../../services/dbApi'),
  useToggleOrderVisibilityMutation: () => [jest.fn(), { isLoading: false }],
}))

const defaultUiState = {
  leftDrawerOpen: false,
  selectedComponent: '',
  claimedOrder: null as any,
  selectedClaim: null as any,
  fulfillMode: false,
  updateClaimMode: false,
}

describe('EmptyOrderHistory', () => {
  it('renders "No orders yet" message', () => {
    renderWithProviders(<EmptyOrderHistory />)

    expect(screen.getByText('No orders yet')).toBeInTheDocument()
    expect(screen.getByText('Your order history will appear here')).toBeInTheDocument()
  })
})

describe('OrderHistory', () => {
  it('renders loading state when userInformation is null', () => {
    renderWithProviders(<OrderHistory />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: null,
        },
      },
    })

    expect(screen.getByText('Loading your orders...')).toBeInTheDocument()
  })

  it('renders empty order history when orders array is empty', () => {
    const sessionData = createMockSessionData({ orders: [] })

    renderWithProviders(<OrderHistory />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: sessionData,
        },
      },
    })

    expect(screen.getByText('No orders yet')).toBeInTheDocument()
  })

  it('renders order names when orders exist', () => {
    const order1 = createMockOrder({ name: 'Motor Mount' })
    const order2 = createMockOrder({ name: 'Gear Housing' })
    const sessionData = createMockSessionData({ orders: [order1, order2] })

    renderWithProviders(<OrderHistory />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: sessionData,
        },
      },
    })

    expect(screen.getByText('Motor Mount')).toBeInTheDocument()
    expect(screen.getByText('Gear Housing')).toBeInTheDocument()
  })
})

describe('OrderedItemCard (rendered via OrderList)', () => {
  it('renders order name', () => {
    const order = createMockOrder({ name: 'My Bracket' })

    renderWithProviders(<OrderList orders={[order]} />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: createMockSessionData(),
        },
      },
    })

    expect(screen.getByText('My Bracket')).toBeInTheDocument()
  })

  it('renders technique, material, and colour chips', () => {
    const order = createMockOrder({
      technique: 'SLS',
      material: 'Nylon 12',
      colour: 'black',
    })

    renderWithProviders(<OrderList orders={[order]} />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: createMockSessionData(),
        },
      },
    })

    expect(screen.getByText('SLS')).toBeInTheDocument()
    expect(screen.getByText('Nylon 12')).toBeInTheDocument()
    expect(screen.getByText('black')).toBeInTheDocument()
  })

  it('renders price and quantity', () => {
    const order = createMockOrder({
      price: 30,
      quantity: 4,
    })

    renderWithProviders(<OrderList orders={[order]} />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: createMockSessionData(),
        },
      },
    })

    expect(screen.getByText('\u00a330.00 x 4')).toBeInTheDocument()
  })

  it('renders "View Details" button', () => {
    const order = createMockOrder()

    renderWithProviders(<OrderList orders={[order]} />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: createMockSessionData(),
        },
      },
    })

    expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument()
  })

  it('renders claimed count', () => {
    const order = createMockOrder({
      quantity: 4,
      quantity_claimed: 2,
    })

    renderWithProviders(<OrderList orders={[order]} />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: createMockSessionData(),
        },
      },
    })

    expect(screen.getByText(/2\/4 claimed/)).toBeInTheDocument()
  })

  it('renders visibility chip as Community when collaborative', () => {
    const order = createMockOrder({ is_collaborative: true })

    renderWithProviders(<OrderList orders={[order]} />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: createMockSessionData(),
        },
      },
    })

    expect(screen.getByText('Community')).toBeInTheDocument()
  })

  it('renders visibility chip as Private when not collaborative', () => {
    const order = createMockOrder({ is_collaborative: false })

    renderWithProviders(<OrderList orders={[order]} />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: createMockSessionData(),
        },
      },
    })

    expect(screen.getByText('Private')).toBeInTheDocument()
  })

  it('renders claim count text when claims exist', () => {
    const order = createMockOrder({
      claims: [
        createMockClaim({ status: 'printing', quantity: 2 }),
      ],
    })

    renderWithProviders(<OrderList orders={[order]} />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: createMockSessionData(),
        },
      },
    })

    expect(screen.getByText('1 claim')).toBeInTheDocument()
  })

  it('renders plural claims text for multiple claims', () => {
    const order = createMockOrder({
      claims: [
        createMockClaim({ status: 'printing', quantity: 1 }),
        createMockClaim({ status: 'shipped', quantity: 1 }),
      ],
    })

    renderWithProviders(<OrderList orders={[order]} />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: createMockSessionData(),
        },
      },
    })

    expect(screen.getByText('2 claims')).toBeInTheDocument()
  })

  it('expands to show claim status chips on click', () => {
    const order = createMockOrder({
      claims: [
        createMockClaim({ status: 'printing', quantity: 2 }),
      ],
    })

    renderWithProviders(<OrderList orders={[order]} />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: createMockSessionData(),
        },
      },
    })

    // Click to expand claims
    fireEvent.click(screen.getByText('1 claim'))

    // Status is displayed with underscores replaced by spaces
    expect(screen.getByText('printing')).toBeInTheDocument()
    expect(screen.getByText('Qty: 2')).toBeInTheDocument()
  })

  it('shows dispute chip when a claim has a dispute status', () => {
    const order = createMockOrder({
      claims: [
        createMockClaim({ status: 'disputed', quantity: 1 }),
      ],
    })

    renderWithProviders(<OrderList orders={[order]} />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: createMockSessionData(),
        },
      },
    })

    // The dispute chip shows the count
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('does not render expandable claim section when no claims exist', () => {
    const order = createMockOrder({ claims: [] })

    renderWithProviders(<OrderList orders={[order]} />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: createMockSessionData(),
        },
      },
    })

    // The expandable "N claim(s)" text should not appear (the meta line "X/Y claimed" is separate)
    expect(screen.queryByText(/^\d+ claims?$/)).not.toBeInTheDocument()
  })
})
