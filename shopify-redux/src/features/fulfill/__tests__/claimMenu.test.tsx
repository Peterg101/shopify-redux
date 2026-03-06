import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { ClaimMenu } from '../claimMenu'
import { createMockOrder } from '../../../test-utils/mockData'

// Mock OBJSTLViewer to avoid three.js imports
jest.mock('../../display/objStlViewer', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-viewer">3D Viewer</div>,
}))

// Mock fetchFileUtils to avoid network calls
jest.mock('../../../services/fetchFileUtils', () => ({
  postClaimOrder: jest.fn().mockResolvedValue({}),
}))

const claimedOrder = createMockOrder({
  name: 'Test Widget',
  material: 'PLA Basic',
  technique: 'FDM',
  colour: 'white',
  quantity: 10,
  quantity_claimed: 3,
})

const defaultUiState = {
  leftDrawerOpen: false,
  drawerWidth: 400,
  selectedComponent: '',
  isLoggedIn: true,
  userInformation: null,
  totalBasketValue: 0,
  claimedOrder,
  updateClaimedOrder: null as any,
}

describe('ClaimMenu', () => {
  it('renders order information', () => {
    renderWithProviders(<ClaimMenu />, {
      preloadedState: { userInterfaceState: defaultUiState },
    })

    expect(screen.getByText('Order Information')).toBeInTheDocument()
    expect(screen.getByText(/Test Widget/)).toBeInTheDocument()
    expect(screen.getByText(/PLA Basic/)).toBeInTheDocument()
    expect(screen.getByText(/FDM/)).toBeInTheDocument()
  })

  it('shows correct max claimable quantity', () => {
    renderWithProviders(<ClaimMenu />, {
      preloadedState: { userInterfaceState: defaultUiState },
    })

    // Max claimable = 10 - 3 = 7
    expect(screen.getByText(/7/)).toBeInTheDocument()
  })

  it('renders confirm and cancel buttons', () => {
    renderWithProviders(<ClaimMenu />, {
      preloadedState: { userInterfaceState: defaultUiState },
    })

    expect(screen.getByText('Confirm Claim')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('has increment and decrement controls', () => {
    renderWithProviders(<ClaimMenu />, {
      preloadedState: { userInterfaceState: defaultUiState },
    })

    const input = screen.getByRole('spinbutton')
    expect(input).toBeInTheDocument()

    // Decrement button exists
    const buttons = screen.getAllByRole('button')
    // There are: decrement, increment, expand viewer, confirm, cancel
    expect(buttons.length).toBeGreaterThanOrEqual(4)
  })

  it('quantity cannot go below 1', () => {
    renderWithProviders(<ClaimMenu />, {
      preloadedState: { userInterfaceState: defaultUiState },
    })

    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '0' } })
    // Value should not update to 0 (clamped at 1)
    expect(input).not.toHaveValue(0)
  })
})
