import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { FulfillOptions } from '../fulfillOptions'
import { createMockOrder, createMockUserInformation, createMockSessionData } from '../../../test-utils/mockData'

// Mock OBJSTLViewer to avoid three.js imports
jest.mock('../../display/objStlViewer', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-viewer">3D Viewer</div>,
}))

describe('FulfillOptions', () => {
  it('renders loading state when user is not loaded', () => {
    const { container } = renderWithProviders(<FulfillOptions />)
    // Loading state now renders skeleton cards instead of text
    const skeletons = container.querySelectorAll('.MuiSkeleton-root')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders empty state when there are no claimable orders', () => {
    const sessionData = createMockSessionData({
      claimable_orders: [],
    })

    renderWithProviders(<FulfillOptions />, {
      preloadedState: {
        userInterfaceState: {
          leftDrawerOpen: false,

          selectedComponent: '',
          userInformation: sessionData,
          claimedOrder: null as any,
          selectedClaim: null as any,
          fulfillMode: false,
          updateClaimMode: false,
        },
      },
    })

    expect(screen.getByText('No orders available right now.')).toBeInTheDocument()
    expect(screen.getByText('New orders appear here when buyers submit collaborative prints.')).toBeInTheDocument()
  })

  it('renders order cards when claimable orders exist', () => {
    const order = createMockOrder({
      name: 'Widget A',
      quantity: 5,
      quantity_claimed: 2,
    })
    const sessionData = createMockSessionData({
      claimable_orders: [order],
    })

    renderWithProviders(<FulfillOptions />, {
      preloadedState: {
        userInterfaceState: {
          leftDrawerOpen: false,

          selectedComponent: '',
          userInformation: sessionData,
          claimedOrder: null as any,
          selectedClaim: null as any,
          fulfillMode: false,
          updateClaimMode: false,
        },
      },
    })

    expect(screen.getByText('Widget A')).toBeInTheDocument()
  })

  it('filters out fully claimed orders', () => {
    const fullyClaimed = createMockOrder({
      name: 'Fully Claimed',
      quantity: 3,
      quantity_claimed: 3,
    })
    const partialClaimed = createMockOrder({
      name: 'Partial Claim',
      quantity: 5,
      quantity_claimed: 2,
    })
    const sessionData = createMockSessionData({
      claimable_orders: [fullyClaimed, partialClaimed],
    })

    renderWithProviders(<FulfillOptions />, {
      preloadedState: {
        userInterfaceState: {
          leftDrawerOpen: false,

          selectedComponent: '',
          userInformation: sessionData,
          claimedOrder: null as any,
          selectedClaim: null as any,
          fulfillMode: false,
          updateClaimMode: false,
        },
      },
    })

    // The fully claimed order should be filtered by OrderCard (returns null if not claimable)
    expect(screen.queryByText('Fully Claimed')).not.toBeInTheDocument()
    expect(screen.getByText('Partial Claim')).toBeInTheDocument()
  })
})
