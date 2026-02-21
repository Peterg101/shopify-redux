import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { ClaimedItems } from '../claimedItems'
import { createMockClaim, createMockOrder, createMockSessionData } from '../../../test-utils/mockData'

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
}

describe('ClaimedItems', () => {
  it('renders empty state when user has no claims', () => {
    const sessionData = createMockSessionData({ claims: [] })

    renderWithProviders(<ClaimedItems />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: sessionData,
        },
      },
    })

    expect(screen.getByText("You haven't claimed anything yet.")).toBeInTheDocument()
  })

  it('renders claim cards when claims exist', () => {
    const order = createMockOrder({ name: 'Claimed Widget', quantity: 5, quantity_claimed: 2 })
    const claim = createMockClaim({ order, quantity: 2 })
    const sessionData = createMockSessionData({ claims: [claim] })

    renderWithProviders(<ClaimedItems />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: sessionData,
        },
      },
    })

    expect(screen.getByText('Claimed Widget')).toBeInTheDocument()
    expect(screen.getByText('Claimed Order')).toBeInTheDocument()
  })

  it('renders multiple claim cards', () => {
    const order1 = createMockOrder({ name: 'Widget Alpha', quantity: 3, quantity_claimed: 1 })
    const order2 = createMockOrder({ name: 'Widget Beta', quantity: 7, quantity_claimed: 4 })
    const claim1 = createMockClaim({ order: order1, quantity: 1 })
    const claim2 = createMockClaim({ order: order2, quantity: 4 })
    const sessionData = createMockSessionData({ claims: [claim1, claim2] })

    renderWithProviders(<ClaimedItems />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: sessionData,
        },
      },
    })

    expect(screen.getByText('Widget Alpha')).toBeInTheDocument()
    expect(screen.getByText('Widget Beta')).toBeInTheDocument()
  })
})
