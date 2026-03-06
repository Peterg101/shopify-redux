import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { FulfillOrClaimed } from '../fulfilledOrClaimed'
import { createMockSessionData, createMockOrder, createMockClaim } from '../../../test-utils/mockData'

// Mock OBJSTLViewer to avoid three.js imports
jest.mock('../../display/objStlViewer', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-viewer">3D Viewer</div>,
}))

const defaultUiState = {
  leftDrawerOpen: false,
  rightDrawerOpen: false,
  basketItems: [],
  drawerWidth: 400,
  selectedComponent: '',
  meshyLoading: false,
  meshyLoadedPercentage: 0,
  meshyPending: false,
  meshyQueueItems: 0,
  isLoggedIn: true,
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

describe('FulfillOrClaimed', () => {
  it('renders both tabs', () => {
    const sessionData = createMockSessionData()

    renderWithProviders(<FulfillOrClaimed />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: sessionData,
        },
      },
    })

    expect(screen.getByText('Available to Fulfill')).toBeInTheDocument()
    expect(screen.getByText('My Claimed Items')).toBeInTheDocument()
  })

  it('shows Available to Fulfill tab content by default', () => {
    const order = createMockOrder({ name: 'Available Order', quantity: 5, quantity_claimed: 1 })
    const sessionData = createMockSessionData({
      claimable_orders: [order],
    })

    renderWithProviders(<FulfillOrClaimed />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: sessionData,
        },
      },
    })

    // FulfillableItems should render (which includes FulfillOptions)
    // The "Available to Fulfill" tab is selected by default
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('switches to My Claimed Items tab on click', () => {
    const sessionData = createMockSessionData({
      claims: [],
    })

    renderWithProviders(<FulfillOrClaimed />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: sessionData,
        },
      },
    })

    const claimedTab = screen.getByText('My Claimed Items')
    fireEvent.click(claimedTab)

    const tabs = screen.getAllByRole('tab')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('displays badge counts for claimable and claimed orders', () => {
    const order1 = createMockOrder({ quantity: 5, quantity_claimed: 1 })
    const order2 = createMockOrder({ quantity: 3, quantity_claimed: 0 })
    const claim1 = createMockClaim()
    const claim2 = createMockClaim()

    const sessionData = createMockSessionData({
      claimable_orders: [order1, order2],
      claims: [claim1, claim2],
    })

    renderWithProviders(<FulfillOrClaimed />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: sessionData,
        },
      },
    })

    // Both badges show "2" (2 claimable orders, 2 claims)
    const badges = screen.getAllByText('2', { selector: '.MuiBadge-badge' })
    expect(badges.length).toBe(2)
  })
})
