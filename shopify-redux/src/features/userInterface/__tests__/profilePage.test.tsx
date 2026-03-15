import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { ProfilePage } from '../profilePage'
import { createMockSessionData } from '../../../test-utils/mockData'

const defaultUiState = {
  leftDrawerOpen: false,

  selectedComponent: '',
  claimedOrder: null as any,
  selectedClaim: null as any,
  fulfillMode: false,
  updateClaimMode: false,
}

describe('ProfilePage', () => {
  it('renders username and email', () => {
    const sessionData = createMockSessionData({
      user: { user_id: 'u1', username: 'janesmith', email: 'jane@example.com' },
    })

    renderWithProviders(<ProfilePage />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: sessionData,
        },
      },
    })

    expect(screen.getByText('janesmith')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
  })

  it('renders stat cards for basket, orders, and claims', () => {
    const sessionData = createMockSessionData({
      basket_items: [
        { task_id: 't1', user_id: 'u1', name: 'Item', material: 'PLA', technique: 'FDM', sizing: 1, colour: 'white', selected_file: 'f.stl', quantity: 2, selectedFileType: 'stl', price: 10 },
      ],
      orders: [],
      claims: [],
    })

    renderWithProviders(<ProfilePage />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: sessionData,
        },
      },
    })

    expect(screen.getByText('Basket Items')).toBeInTheDocument()
    expect(screen.getByText('Orders')).toBeInTheDocument()
    expect(screen.getByText('Active Claims')).toBeInTheDocument()
  })

  it('renders the logout button', () => {
    const sessionData = createMockSessionData()

    renderWithProviders(<ProfilePage />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: sessionData,
        },
      },
    })

    expect(screen.getByText('Log Out')).toBeInTheDocument()
  })

  it('renders correct stat counts for basket, orders, and claims', () => {
    const sessionData = createMockSessionData({
      basket_items: [
        { task_id: 'b1', user_id: 'u1', name: 'Item 1', material: 'PLA', technique: 'FDM', sizing: 1, colour: 'white', selected_file: 'a.stl', quantity: 1, selectedFileType: 'stl', price: 10 },
        { task_id: 'b2', user_id: 'u1', name: 'Item 2', material: 'PLA', technique: 'FDM', sizing: 1, colour: 'black', selected_file: 'b.stl', quantity: 1, selectedFileType: 'stl', price: 15 },
        { task_id: 'b3', user_id: 'u1', name: 'Item 3', material: 'ABS', technique: 'FDM', sizing: 2, colour: 'red', selected_file: 'c.stl', quantity: 1, selectedFileType: 'stl', price: 20 },
      ],
      orders: [
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
      ],
      claims: [
        {
          id: 'c1', order_id: 'o1', claimant_user_id: 'u1', quantity: 1, status: 'pending',
          created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
          order: {
            order_id: 'o1', user_id: 'u1', task_id: 't1', name: 'Order 1', material: 'PLA Basic', technique: 'FDM',
            sizing: 1, colour: 'white', selectedFile: 'f.stl', selectedFileType: 'stl', price: 25, quantity: 1,
            quantity_claimed: 1, created_at: '2025-01-01T00:00:00Z', is_collaborative: true, status: 'open', qa_level: 'standard', claims: [],
          },
        },
      ],
    })

    renderWithProviders(<ProfilePage />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: sessionData,
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
    const sessionData = createMockSessionData({
      basket_items: [],
      orders: [],
      claims: [],
    })

    renderWithProviders(<ProfilePage />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: sessionData,
        },
      },
    })

    // All three stat cards should show 0
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBe(3)
  })
})
