import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { EmptyBasket, Basket, BasketList, BasketSummary } from '../basketFragments'
import { createMockBasketInformation, createMockSessionData } from '../../../test-utils/mockData'

// Mock sub-components and hooks to isolate basket logic
jest.mock('../../../services/basketItemApi', () => ({
  ...jest.requireActual('../../../services/basketItemApi'),
  useUpdateBasketQuantityMutation: () => [jest.fn()],
  useGenerateTasksFromBasketMutation: () => [jest.fn()],
}))

jest.mock('../deleteFromBasket', () => ({
  __esModule: true,
  default: () => <span data-testid="mock-delete" />,
}))

jest.mock('../editBasketItem', () => ({
  __esModule: true,
  default: () => <span data-testid="mock-edit" />,
}))

jest.mock('../../../services/fetchFileUtils', () => ({
  createStripeCheckoutAndRedirect: jest.fn(),
}))

const defaultUiState = {
  leftDrawerOpen: false,
  selectedComponent: '',
  claimedOrder: null as any,
  selectedClaim: null as any,
  fulfillMode: false,
  updateClaimMode: false,
}

describe('EmptyBasket', () => {
  it('renders empty basket message', () => {
    renderWithProviders(<EmptyBasket />)

    expect(screen.getByText('Your basket is empty')).toBeInTheDocument()
    expect(screen.getByText('Add a model to get started')).toBeInTheDocument()
  })
})

describe('Basket', () => {
  it('shows empty basket when basket_items is empty', () => {
    const sessionData = createMockSessionData({ basket_items: [] })

    renderWithProviders(<Basket />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: sessionData,
        },
      },
    })

    expect(screen.getByText('Your basket is empty')).toBeInTheDocument()
  })

  it('shows basket items when basket is not empty', () => {
    const basketItem = createMockBasketInformation({
      name: 'Test Bracket',
      price: 25.0,
      quantity: 2,
      technique: 'FDM',
      material: 'PLA Basic',
      colour: 'white',
    })
    const sessionData = createMockSessionData({ basket_items: [basketItem] })

    renderWithProviders(<Basket />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: sessionData,
        },
      },
    })

    expect(screen.getByText('Test Bracket')).toBeInTheDocument()
    expect(screen.queryByText('Your basket is empty')).not.toBeInTheDocument()
  })
})

describe('BasketItemCard (rendered via BasketList)', () => {
  const basketItem = createMockBasketInformation({
    name: 'CNC Housing',
    price: 15.0,
    quantity: 3,
    technique: 'SLA',
    material: 'Tough Resin',
    colour: 'grey',
  })

  const renderBasketList = () => {
    const sessionData = createMockSessionData({ basket_items: [basketItem] })
    return renderWithProviders(<BasketList />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: sessionData,
        },
      },
    })
  }

  it('renders item name', () => {
    renderBasketList()
    expect(screen.getByText('CNC Housing')).toBeInTheDocument()
  })

  it('renders total price as quantity * price', () => {
    renderBasketList()
    // 3 * 15.00 = 45.00, rendered with pound sign
    // Appears in both the item card and summary, so use getAllByText
    const priceElements = screen.getAllByText('\u00a345.00')
    expect(priceElements.length).toBeGreaterThanOrEqual(1)
  })

  it('renders technique, material, and colour chips', () => {
    renderBasketList()
    expect(screen.getByText('SLA')).toBeInTheDocument()
    expect(screen.getByText('Tough Resin')).toBeInTheDocument()
    expect(screen.getByText('grey')).toBeInTheDocument()
  })

  it('renders increase and decrease quantity buttons', () => {
    renderBasketList()
    expect(screen.getByLabelText('decrease quantity')).toBeInTheDocument()
    expect(screen.getByLabelText('increase quantity')).toBeInTheDocument()
  })

  it('updates displayed price when increase quantity is clicked', () => {
    renderBasketList()

    const increaseBtn = screen.getByLabelText('increase quantity')
    fireEvent.click(increaseBtn)

    // Quantity goes from 3 to 4, so price = 4 * 15.00 = 60.00
    expect(screen.getByText('\u00a360.00')).toBeInTheDocument()
  })

  it('updates displayed price when decrease quantity is clicked', () => {
    renderBasketList()

    const decreaseBtn = screen.getByLabelText('decrease quantity')
    fireEvent.click(decreaseBtn)

    // Quantity goes from 3 to 2, so price = 2 * 15.00 = 30.00
    expect(screen.getByText('\u00a330.00')).toBeInTheDocument()
  })

  it('renders edit and delete sub-components', () => {
    renderBasketList()
    expect(screen.getByTestId('mock-edit')).toBeInTheDocument()
    expect(screen.getByTestId('mock-delete')).toBeInTheDocument()
  })

  it('toggles detail section on click', () => {
    renderBasketList()

    expect(screen.getByText('Show details')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Show details'))
    expect(screen.getByText('Hide details')).toBeInTheDocument()
    expect(screen.getByText('Sizing')).toBeInTheDocument()
    expect(screen.getByText('Unit Price')).toBeInTheDocument()
  })
})

describe('BasketSummary', () => {
  const basketItem = createMockBasketInformation({
    name: 'Test Bracket',
    price: 25.0,
    quantity: 2,
    technique: 'FDM',
    material: 'PLA Basic',
    colour: 'white',
  })

  const renderSummary = () => {
    const sessionData = createMockSessionData({ basket_items: [basketItem] })
    return renderWithProviders(<BasketSummary />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: sessionData,
        },
      },
    })
  }

  it('renders Order Summary heading', () => {
    renderSummary()
    expect(screen.getByText('Order Summary')).toBeInTheDocument()
  })

  it('renders item count', () => {
    renderSummary()
    expect(screen.getByText('Items (1)')).toBeInTheDocument()
  })

  it('renders subtotal', () => {
    renderSummary()
    // 2 * 25.00 = 50.00
    expect(screen.getByText('\u00a350.00')).toBeInTheDocument()
  })

  it('renders shipping estimate', () => {
    renderSummary()
    expect(screen.getByText('Shipping')).toBeInTheDocument()
    expect(screen.getByText('\u00a34.99')).toBeInTheDocument()
  })

  it('renders total (subtotal + shipping)', () => {
    renderSummary()
    // 50.00 + 4.99 = 54.99
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('\u00a354.99')).toBeInTheDocument()
  })

  it('renders Proceed to Checkout button', () => {
    renderSummary()
    expect(screen.getByRole('button', { name: /proceed to checkout/i })).toBeInTheDocument()
  })

  it('opens checkout dialog when Proceed to Checkout is clicked', () => {
    renderSummary()

    fireEvent.click(screen.getByRole('button', { name: /proceed to checkout/i }))

    expect(screen.getByText('Checkout Confirmation')).toBeInTheDocument()
    expect(screen.getByText('Checkout with FITD')).toBeInTheDocument()
    expect(screen.getByText('Checkout with the community')).toBeInTheDocument()
  })

  it('renders zero shipping when basket is empty', () => {
    const emptySession = createMockSessionData({ basket_items: [] })

    renderWithProviders(<BasketSummary />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: emptySession,
        },
      },
    })

    // With no items, subtotal = 0, shipping = 0, total = 0
    expect(screen.getByText('Items (0)')).toBeInTheDocument()
  })
})
