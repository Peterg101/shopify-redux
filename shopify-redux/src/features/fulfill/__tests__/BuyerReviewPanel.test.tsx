import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { BuyerReviewPanel } from '../BuyerReviewPanel'
import {
  createMockOrder,
  createMockClaim,
} from '../../../test-utils/mockData'

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

// Mock RTK Query hooks to avoid MSW / network dependency
const mockUpdateStatus = jest.fn().mockReturnValue({ unwrap: jest.fn().mockResolvedValue({}) })
jest.mock('../../../services/dbApi', () => ({
  ...jest.requireActual('../../../services/dbApi'),
  useGetClaimEvidenceQuery: () => ({ data: [], isLoading: false }),
  useUpdateClaimStatusMutation: () => [mockUpdateStatus, { isLoading: false }],
}))

// ── Test data ──────────────────────────────────────────────────────────
const order = createMockOrder({
  name: 'Widget Pro',
  material: 'PETG',
  technique: 'FDM',
  colour: 'blue',
})
const claim = createMockClaim({
  order,
  status: 'delivered',
  quantity: 3,
})
const claimWithTracking = createMockClaim({
  order,
  status: 'delivered',
  quantity: 3,
  tracking_number: 'TRK-9876',
  carrier_code: 'evri',
})
const onClose = jest.fn()

// ── Tests ──────────────────────────────────────────────────────────────
describe('BuyerReviewPanel', () => {
  afterEach(() => {
    onClose.mockClear()
  })

  it('renders "Review Delivered Order" heading', () => {
    renderWithProviders(<BuyerReviewPanel claim={claim} onClose={onClose} />)
    expect(screen.getByText('Review Delivered Order')).toBeInTheDocument()
  })

  it('renders order details', () => {
    renderWithProviders(<BuyerReviewPanel claim={claim} onClose={onClose} />)
    expect(screen.getByText(/Widget Pro/)).toBeInTheDocument()
    expect(screen.getByText(/PETG/)).toBeInTheDocument()
    expect(screen.getByText(/FDM/)).toBeInTheDocument()
    expect(screen.getByText(/blue/)).toBeInTheDocument()
    expect(screen.getByText(/3/)).toBeInTheDocument()
  })

  it('renders Accept button', () => {
    renderWithProviders(<BuyerReviewPanel claim={claim} onClose={onClose} />)
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument()
  })

  it('renders Dispute button initially (not Submit Dispute)', () => {
    renderWithProviders(<BuyerReviewPanel claim={claim} onClose={onClose} />)
    expect(screen.getByRole('button', { name: /^dispute$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /submit dispute/i })).not.toBeInTheDocument()
  })

  it('clicking Dispute shows dispute form with Submit Dispute button', () => {
    renderWithProviders(<BuyerReviewPanel claim={claim} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /^dispute$/i }))
    expect(screen.getByLabelText(/dispute reason/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit dispute/i })).toBeInTheDocument()
  })

  it('renders Cancel button', () => {
    renderWithProviders(<BuyerReviewPanel claim={claim} onClose={onClose} />)
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('shows tracking info when present', () => {
    renderWithProviders(
      <BuyerReviewPanel claim={claimWithTracking} onClose={onClose} />
    )
    expect(screen.getByText(/Tracking:/)).toBeInTheDocument()
    expect(screen.getByText(/TRK-9876/)).toBeInTheDocument()
  })
})
