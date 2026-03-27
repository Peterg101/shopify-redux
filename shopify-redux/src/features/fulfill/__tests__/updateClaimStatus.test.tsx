import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { UpdateClaimStatus } from '../updateClaimStatus'
import {
  createMockOrder,
  createMockClaim,
  createMockSlimSession,
} from '../../../test-utils/mockData'
import { Claim } from '../../../app/utility/interfaces'

// ── Critical mocks ─────────────────────────────────────────────────────
jest.mock('../../display/objStlViewer', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-3d-viewer">3D Viewer</div>,
}))

jest.mock('../../display/OrientationControls', () => ({
  OrientationControls: () => (
    <div data-testid="mock-orientation-controls">Controls</div>
  ),
}))

jest.mock('../../../services/fetchFileUtils', () => ({
  createShippingLabel: jest.fn().mockResolvedValue({
    label_url: 'https://label.pdf',
    tracking_number: 'TRACK123',
    carrier_code: 'evri',
  }),
}))

jest.mock('../../../app/utility/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

jest.mock('../BuyerReviewPanel', () => ({
  BuyerReviewPanel: ({ claim, onClose }: any) => (
    <div data-testid="buyer-review-panel">BuyerReview: {claim.id}</div>
  ),
}))

jest.mock('../DisputePanel', () => ({
  DisputePanel: ({ claim, onClose }: any) => (
    <div data-testid="dispute-panel">Dispute: {claim.id}</div>
  ),
}))

jest.mock('react-dropzone', () => ({
  useDropzone: () => ({
    getRootProps: () => ({ 'data-testid': 'dropzone' }),
    getInputProps: () => ({ 'data-testid': 'dropzone-input' }),
    isDragActive: false,
  }),
}))

// Mock RTK Query mutations to avoid network calls
const mockUpdateStatus = jest.fn().mockReturnValue({ unwrap: jest.fn().mockResolvedValue({}) })
const mockUploadEvidence = jest.fn().mockReturnValue({ unwrap: jest.fn().mockResolvedValue({}) })
jest.mock('../../../services/dbApi', () => ({
  ...jest.requireActual('../../../services/dbApi'),
  useUpdateClaimStatusMutation: () => [mockUpdateStatus, { isLoading: false }],
  useUploadClaimEvidenceMutation: () => [mockUploadEvidence, { isLoading: false }],
}))

// ── Helper to build preloaded state ────────────────────────────────────
function makeState(claimOverrides: Partial<Claim> = {}, isBuyer = false) {
  const order = createMockOrder({
    name: 'Test Part',
    material: 'PLA Basic',
    technique: 'FDM',
    colour: 'white',
    qa_level: 'standard',
  })
  const claim = createMockClaim({
    order,
    status: 'pending',
    quantity: 2,
    ...claimOverrides,
  })
  const userId = isBuyer ? order.user_id : 'claimant-1'
  const session = createMockSlimSession({
    user: { user_id: userId, username: 'tester', email: 'test@test.com' },
  })
  return {
    userInterfaceState: {
      leftDrawerOpen: false,
      selectedComponent: '',
      claimedOrder: null as any,
      fulfillMode: true,
      updateClaimMode: true,
      selectedClaim: claim,
      userInformation: session,
    },
  }
}

// ── Tests ──────────────────────────────────────────────────────────────
describe('UpdateClaimStatus', () => {
  it('renders null when no selectedClaim', () => {
    const state = makeState()
    state.userInterfaceState.selectedClaim = null
    const { container } = renderWithProviders(<UpdateClaimStatus />, {
      preloadedState: state,
    })
    expect(container.innerHTML).toBe('')
  })

  it('renders order information', () => {
    renderWithProviders(<UpdateClaimStatus />, {
      preloadedState: makeState(),
    })
    expect(screen.getByText('Order Information')).toBeInTheDocument()
    expect(screen.getByText(/Test Part/)).toBeInTheDocument()
    expect(screen.getByText(/PLA Basic/)).toBeInTheDocument()
    expect(screen.getByText(/FDM/)).toBeInTheDocument()
    expect(screen.getByText(/white/)).toBeInTheDocument()
  })

  it('shows quantity and status chips', () => {
    renderWithProviders(<UpdateClaimStatus />, {
      preloadedState: makeState(),
    })
    expect(screen.getByText('2 units')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('shows QA level chip', () => {
    renderWithProviders(<UpdateClaimStatus />, {
      preloadedState: makeState(),
    })
    expect(screen.getByText('Standard')).toBeInTheDocument()
  })

  it('shows MiniStepper', () => {
    renderWithProviders(<UpdateClaimStatus />, {
      preloadedState: makeState(),
    })
    expect(screen.getByText('Claim Progress')).toBeInTheDocument()
  })

  it('shows status dropdown for pending claim', () => {
    renderWithProviders(<UpdateClaimStatus />, {
      preloadedState: makeState(),
    })
    // The dropdown should show "In Progress" as the pre-selected first valid transition
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  it('shows cancel option for pending claim when dropdown is opened', () => {
    renderWithProviders(<UpdateClaimStatus />, {
      preloadedState: makeState(),
    })
    // MUI Select renders MenuItems in a portal only when opened
    // Open the select dropdown by clicking on the select trigger
    const selectButton = screen.getByRole('combobox')
    fireEvent.mouseDown(selectButton)
    // Now the MenuItem portal should be in the DOM
    expect(screen.getByText('Cancel Claim')).toBeInTheDocument()
  })

  it('shows Confirm and Back buttons', () => {
    renderWithProviders(<UpdateClaimStatus />, {
      preloadedState: makeState(),
    })
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
  })

  it('delegates to BuyerReviewPanel when delivered and user is buyer', () => {
    renderWithProviders(<UpdateClaimStatus />, {
      preloadedState: makeState({ status: 'delivered' }, true),
    })
    expect(screen.getByTestId('buyer-review-panel')).toBeInTheDocument()
    expect(screen.queryByText('Order Information')).not.toBeInTheDocument()
  })

  it('delegates to DisputePanel when disputed', () => {
    renderWithProviders(<UpdateClaimStatus />, {
      preloadedState: makeState({ status: 'disputed' }),
    })
    expect(screen.getByTestId('dispute-panel')).toBeInTheDocument()
    expect(screen.queryByText('Order Information')).not.toBeInTheDocument()
  })
})
