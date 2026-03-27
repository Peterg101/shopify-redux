import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { DisputePanel } from '../DisputePanel'
import {
  createMockOrder,
  createMockClaim,
  createMockDispute,
  createMockSlimSession,
} from '../../../test-utils/mockData'
import { Dispute } from '../../../app/utility/interfaces'

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

// ── Shared test data ───────────────────────────────────────────────────
const order = createMockOrder({ user_id: 'buyer-1' })
const baseClaim = createMockClaim({
  order,
  status: 'disputed',
  claimant_user_id: 'claimant-1',
})
const onClose = jest.fn()

// ── Mock RTK Query hooks ───────────────────────────────────────────────
const mockOpenDispute = createMockDispute({ status: 'open', reason: 'Item damaged' })
let mockDisputeData: Dispute | undefined = undefined
let mockDisputeLoading = true

const mockRespondToDispute = jest.fn().mockReturnValue({ unwrap: jest.fn().mockResolvedValue({}) })
const mockResolveDispute = jest.fn().mockReturnValue({ unwrap: jest.fn().mockResolvedValue({}) })
const mockUploadDisputeEvidence = jest.fn().mockReturnValue({ unwrap: jest.fn().mockResolvedValue({}) })

jest.mock('../../../services/dbApi', () => ({
  ...jest.requireActual('../../../services/dbApi'),
  useGetDisputeQuery: () => ({
    data: mockDisputeData,
    isLoading: mockDisputeLoading,
  }),
  useGetClaimEvidenceQuery: () => ({ data: [], isLoading: false }),
  useRespondToDisputeMutation: () => [mockRespondToDispute, { isLoading: false }],
  useResolveDisputeMutation: () => [mockResolveDispute, { isLoading: false }],
  useUploadDisputeEvidenceMutation: () => [mockUploadDisputeEvidence, { isLoading: false }],
}))

afterEach(() => {
  onClose.mockClear()
  // Reset mock dispute state for each test
  mockDisputeData = undefined
  mockDisputeLoading = true
})

// ── Helper to build preloaded state ────────────────────────────────────
function makeDisputeState(userId: string) {
  const session = createMockSlimSession({
    user: { user_id: userId, username: 'user', email: 'u@t.com' },
  })
  return {
    userInterfaceState: {
      leftDrawerOpen: false,
      selectedComponent: '',
      claimedOrder: null as any,
      fulfillMode: false,
      updateClaimMode: false,
      selectedClaim: baseClaim,
      userInformation: session,
    },
  }
}

// ── Tests ──────────────────────────────────────────────────────────────
describe('DisputePanel', () => {
  it('shows loading state initially', () => {
    mockDisputeLoading = true
    mockDisputeData = undefined
    renderWithProviders(
      <DisputePanel claim={baseClaim} onClose={onClose} />,
      { preloadedState: makeDisputeState('claimant-1') }
    )
    expect(screen.getByText('Loading dispute...')).toBeInTheDocument()
  })

  it('renders dispute info after loading', () => {
    mockDisputeLoading = false
    mockDisputeData = mockOpenDispute
    renderWithProviders(
      <DisputePanel claim={baseClaim} onClose={onClose} />,
      { preloadedState: makeDisputeState('claimant-1') }
    )
    expect(screen.getByText('Dispute')).toBeInTheDocument()
    expect(screen.getByText(/Item damaged/)).toBeInTheDocument()
  })

  it('fulfiller sees response form for open dispute', () => {
    mockDisputeLoading = false
    mockDisputeData = mockOpenDispute
    renderWithProviders(
      <DisputePanel claim={baseClaim} onClose={onClose} />,
      { preloadedState: makeDisputeState('claimant-1') }
    )
    expect(screen.getByText('Your Response')).toBeInTheDocument()
    expect(screen.getByLabelText(/response/i)).toBeInTheDocument()
    const submitBtn = screen.getByRole('button', { name: /submit response/i })
    expect(submitBtn).toBeInTheDocument()
    expect(submitBtn).toBeDisabled()
  })

  it('buyer sees waiting message for open dispute', () => {
    mockDisputeLoading = false
    mockDisputeData = mockOpenDispute
    renderWithProviders(
      <DisputePanel claim={baseClaim} onClose={onClose} />,
      { preloadedState: makeDisputeState('buyer-1') }
    )
    expect(
      screen.getByText(/waiting for fulfiller to respond/i)
    ).toBeInTheDocument()
  })

  it('buyer sees resolution buttons for responded dispute', () => {
    mockDisputeLoading = false
    mockDisputeData = createMockDispute({
      status: 'responded',
      reason: 'Item damaged',
      fulfiller_response: 'We will fix it',
      buyer_deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    })
    renderWithProviders(
      <DisputePanel claim={baseClaim} onClose={onClose} />,
      { preloadedState: makeDisputeState('buyer-1') }
    )
    expect(screen.getByRole('button', { name: /accept \(full pay\)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /partial refund/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reject \(no pay\)/i })).toBeInTheDocument()
  })

  it('shows deadline info for open dispute', () => {
    mockDisputeLoading = false
    mockDisputeData = mockOpenDispute
    renderWithProviders(
      <DisputePanel claim={baseClaim} onClose={onClose} />,
      { preloadedState: makeDisputeState('claimant-1') }
    )
    expect(screen.getByText(/fulfiller response deadline/i)).toBeInTheDocument()
  })
})
