import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { ClaimedItems } from '../claimedItems'
import { createMockClaim, createMockOrder, createMockSlimSession } from '../../../test-utils/mockData'
import { Claim } from '../../../app/utility/interfaces'

// Mock OBJSTLViewer to avoid three.js imports
jest.mock('../../display/objStlViewer', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-viewer">3D Viewer</div>,
}))

// Mock RTK Query hook for claims
let mockClaimsData: Claim[] = []

jest.mock('../../../services/authApi', () => ({
  ...jest.requireActual('../../../services/authApi'),
  useGetUserClaimsQuery: () => ({
    data: mockClaimsData,
    isLoading: false,
  }),
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
  mockClaimsData = []
})

describe('ClaimedItems', () => {
  it('renders empty state when user has no claims', () => {
    mockClaimsData = []
    const session = createMockSlimSession()

    renderWithProviders(<ClaimedItems />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: session,
        },
      },
    })

    expect(screen.getByText("You haven't claimed any orders yet.")).toBeInTheDocument()
    expect(screen.getByText('Head to the Available to Fulfill tab to browse and claim orders.')).toBeInTheDocument()
  })

  it('renders claim cards when claims exist', () => {
    const order = createMockOrder({ name: 'Claimed Widget', quantity: 5, quantity_claimed: 2 })
    const claim = createMockClaim({ order, quantity: 2 })
    mockClaimsData = [claim]
    const session = createMockSlimSession()

    renderWithProviders(<ClaimedItems />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: session,
        },
      },
    })

    expect(screen.getByText('Claimed Widget')).toBeInTheDocument()
    expect(screen.getByText('Update Status')).toBeInTheDocument()
  })

  it('renders multiple claim cards', () => {
    const order1 = createMockOrder({ name: 'Widget Alpha', quantity: 3, quantity_claimed: 1 })
    const order2 = createMockOrder({ name: 'Widget Beta', quantity: 7, quantity_claimed: 4 })
    const claim1 = createMockClaim({ order: order1, quantity: 1 })
    const claim2 = createMockClaim({ order: order2, quantity: 4 })
    mockClaimsData = [claim1, claim2]
    const session = createMockSlimSession()

    renderWithProviders(<ClaimedItems />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: session,
        },
      },
    })

    expect(screen.getByText('Widget Alpha')).toBeInTheDocument()
    expect(screen.getByText('Widget Beta')).toBeInTheDocument()
  })

  it('renders dashboard header with progress', () => {
    const order = createMockOrder({ name: 'Progress Test', quantity: 5, quantity_claimed: 2, price: 25 })
    const claim = createMockClaim({ order, quantity: 2, status: 'accepted' })
    mockClaimsData = [claim]
    const session = createMockSlimSession()

    renderWithProviders(<ClaimedItems />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: session,
        },
      },
    })

    expect(screen.getByText('Overall Progress')).toBeInTheDocument()
    expect(screen.getByText('1/1 completed')).toBeInTheDocument()
  })

  it('shows toolbar with result count', () => {
    const order = createMockOrder({ name: 'Toolbar Test', quantity: 3, quantity_claimed: 1 })
    const claim = createMockClaim({ order, quantity: 1 })
    mockClaimsData = [claim]
    const session = createMockSlimSession()

    renderWithProviders(<ClaimedItems />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: session,
        },
      },
    })

    expect(screen.getByText('Showing 1 claim')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search claims...')).toBeInTheDocument()
  })
})
