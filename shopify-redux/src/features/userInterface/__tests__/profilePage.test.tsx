import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { ProfilePage } from '../profilePage'
import { createMockSlimSession } from '../../../test-utils/mockData'
import { BasketInformation, Order, Claim } from '../../../app/utility/interfaces'

// Mock RTK Query hooks for profile page data
let mockBasketData: BasketInformation[] = []
let mockOrdersData: Order[] = []
let mockClaimsData: Claim[] = []

jest.mock('../../../services/authApi', () => ({
  ...jest.requireActual('../../../services/authApi'),
  useGetUserBasketQuery: () => ({
    data: mockBasketData,
    isLoading: false,
  }),
  useGetUserOrdersQuery: () => ({
    data: mockOrdersData,
    isLoading: false,
  }),
  useGetUserClaimsQuery: () => ({
    data: mockClaimsData,
    isLoading: false,
  }),
  useLogOutMutation: () => [jest.fn(), { isLoading: false }],
}))

const defaultUiState = {
  leftDrawerOpen: false,

  selectedComponent: '',
  claimedOrder: null as any,
  selectedClaim: null as any,
  fulfillMode: false,
  updateClaimMode: false,
}

afterEach(() => {
  mockBasketData = []
  mockOrdersData = []
  mockClaimsData = []
})

describe('ProfilePage', () => {
  it('renders username and email', () => {
    const session = createMockSlimSession({
      user: { user_id: 'u1', username: 'janesmith', email: 'jane@example.com' },
    })

    renderWithProviders(<ProfilePage />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: session,
        },
      },
    })

    expect(screen.getByText('janesmith')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
  })

  it('renders stat cards for basket, orders, and claims', () => {
    mockBasketData = [
      { task_id: 't1', user_id: 'u1', name: 'Item', material: 'PLA', technique: 'FDM', sizing: 1, colour: 'white', selectedFile: 'f.stl', quantity: 2, selectedFileType: 'stl', price: 10 },
    ]
    mockOrdersData = []
    mockClaimsData = []
    const session = createMockSlimSession()

    renderWithProviders(<ProfilePage />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: session,
        },
      },
    })

    expect(screen.getByText('Basket Items')).toBeInTheDocument()
    expect(screen.getByText('Orders')).toBeInTheDocument()
    expect(screen.getByText('Active Claims')).toBeInTheDocument()
  })

  it('renders the logout button', () => {
    const session = createMockSlimSession()

    renderWithProviders(<ProfilePage />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: session,
        },
      },
    })

    expect(screen.getByText('Log Out')).toBeInTheDocument()
  })

  it('renders correct stat counts for basket, orders, and claims', () => {
    mockBasketData = [
      { task_id: 'b1', user_id: 'u1', name: 'Item 1', material: 'PLA', technique: 'FDM', sizing: 1, colour: 'white', selectedFile: 'a.stl', quantity: 1, selectedFileType: 'stl', price: 10 },
      { task_id: 'b2', user_id: 'u1', name: 'Item 2', material: 'PLA', technique: 'FDM', sizing: 1, colour: 'black', selectedFile: 'b.stl', quantity: 1, selectedFileType: 'stl', price: 15 },
      { task_id: 'b3', user_id: 'u1', name: 'Item 3', material: 'ABS', technique: 'FDM', sizing: 2, colour: 'red', selectedFile: 'c.stl', quantity: 1, selectedFileType: 'stl', price: 20 },
    ]
    mockOrdersData = [
      {
        order_id: 'o1', user_id: 'u1', task_id: 't1', name: 'Order 1', material: 'PLA Basic', technique: 'FDM',
        sizing: 1, colour: 'white', selectedFile: 'f.stl', selectedFileType: 'stl', price: 25, quantity: 1,
        quantity_claimed: 0, created_at: '2025-01-01T00:00:00Z', is_collaborative: true, status: 'open', qa_level: 'standard', claims: [],
      },
      {
        order_id: 'o2', user_id: 'u1', task_id: 't2', name: 'Order 2', material: 'PLA Basic', technique: 'FDM',
        sizing: 1, colour: 'black', selectedFile: 'g.stl', selectedFileType: 'stl', price: 30, quantity: 2,
        quantity_claimed: 0, created_at: '2025-01-02T00:00:00Z', is_collaborative: true, status: 'open', qa_level: 'standard', claims: [],
      },
    ]
    mockClaimsData = [
      {
        id: 'c1', order_id: 'o1', claimant_user_id: 'u1', quantity: 1, status: 'pending',
        created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
        order: {
          order_id: 'o1', user_id: 'u1', task_id: 't1', name: 'Order 1', material: 'PLA Basic', technique: 'FDM',
          sizing: 1, colour: 'white', selectedFile: 'f.stl', selectedFileType: 'stl', price: 25, quantity: 1,
          quantity_claimed: 1, created_at: '2025-01-01T00:00:00Z', is_collaborative: true, status: 'open', qa_level: 'standard', claims: [],
        },
      },
    ]
    const session = createMockSlimSession()

    renderWithProviders(<ProfilePage />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: session,
        },
      },
    })

    // The stat values are rendered as h6 Typography elements
    // 3 basket items, 2 orders, 1 claim
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('shows stat counts of zero gracefully with empty arrays', () => {
    mockBasketData = []
    mockOrdersData = []
    mockClaimsData = []
    const session = createMockSlimSession()

    renderWithProviders(<ProfilePage />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: session,
        },
      },
    })

    // All three stat cards should show 0
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBe(3)
  })
})
