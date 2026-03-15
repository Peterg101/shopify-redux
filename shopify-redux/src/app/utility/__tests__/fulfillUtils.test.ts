// Mock ClaimDashboardHeader BEFORE importing fulfillUtils (which depends on it).
// The real module uses JSX icons which would require React rendering setup.
jest.mock('../../../features/fulfill/ClaimDashboardHeader', () => ({
  STATUS_PHASES: [
    { label: 'Pending', statuses: ['pending'], color: 'default' },
    { label: 'In Progress', statuses: ['in_progress', 'printing'], color: 'info' },
    { label: 'QA / Ready', statuses: ['qa_check'], color: 'warning' },
    { label: 'Shipping', statuses: ['shipped', 'delivered'], color: 'primary' },
    { label: 'Complete', statuses: ['accepted'], color: 'success' },
    {
      label: 'Disputed',
      statuses: ['disputed', 'resolved_accepted', 'resolved_partial', 'resolved_rejected'],
      color: 'error',
    },
    { label: 'Cancelled', statuses: ['cancelled'], color: 'default' },
  ],
}))

import {
  getScarcityColor,
  getPhaseIndex,
  getPhaseColor,
  getStatusDescription,
  getStatusLabel,
} from '../fulfillUtils'

describe('fulfillUtils', () => {
  // ── getScarcityColor ─────────────────────────────────────────────────
  describe('getScarcityColor', () => {
    it('returns red (#FF5252) when ratio <= 25%', () => {
      expect(getScarcityColor(2, 10)).toBe('#FF5252') // 20%
    })

    it('returns red (#FF5252) when ratio is exactly 25%', () => {
      expect(getScarcityColor(25, 100)).toBe('#FF5252')
    })

    it('returns orange (#FF9100) when ratio <= 50%', () => {
      expect(getScarcityColor(4, 10)).toBe('#FF9100') // 40%
    })

    it('returns orange (#FF9100) when ratio is exactly 50%', () => {
      expect(getScarcityColor(50, 100)).toBe('#FF9100')
    })

    it('returns cyan (#00E5FF) when ratio > 50%', () => {
      expect(getScarcityColor(8, 10)).toBe('#00E5FF') // 80%
    })

    it('returns red when remaining <= 3 regardless of ratio', () => {
      // ratio = 3/100 = 3%, but also remaining <= 3
      expect(getScarcityColor(3, 100)).toBe('#FF5252')
      // ratio = 3/4 = 75% which would normally be cyan, but remaining <= 3
      expect(getScarcityColor(3, 4)).toBe('#FF5252')
    })

    it('returns red when remaining is 1', () => {
      expect(getScarcityColor(1, 1000)).toBe('#FF5252')
    })

    it('returns cyan for healthy stock levels', () => {
      expect(getScarcityColor(100, 100)).toBe('#00E5FF') // 100%
    })
  })

  // ── getPhaseIndex ────────────────────────────────────────────────────
  describe('getPhaseIndex', () => {
    it('returns 0 for pending', () => {
      expect(getPhaseIndex('pending')).toBe(0)
    })

    it('returns 1 for in_progress', () => {
      expect(getPhaseIndex('in_progress')).toBe(1)
    })

    it('returns 1 for printing (grouped with in_progress)', () => {
      expect(getPhaseIndex('printing')).toBe(1)
    })

    it('returns 2 for qa_check', () => {
      expect(getPhaseIndex('qa_check')).toBe(2)
    })

    it('returns 3 for shipped', () => {
      expect(getPhaseIndex('shipped')).toBe(3)
    })

    it('returns 3 for delivered', () => {
      expect(getPhaseIndex('delivered')).toBe(3)
    })

    it('returns 4 for accepted', () => {
      expect(getPhaseIndex('accepted')).toBe(4)
    })

    it('returns 5 for disputed', () => {
      expect(getPhaseIndex('disputed')).toBe(5)
    })

    it('returns 5 for resolved_accepted', () => {
      expect(getPhaseIndex('resolved_accepted')).toBe(5)
    })

    it('returns 6 for cancelled', () => {
      expect(getPhaseIndex('cancelled')).toBe(6)
    })

    it('returns 0 for unknown status (fallback)', () => {
      expect(getPhaseIndex('nonexistent_status')).toBe(0)
    })

    it('returns 0 for empty string', () => {
      expect(getPhaseIndex('')).toBe(0)
    })
  })

  // ── getPhaseColor ────────────────────────────────────────────────────
  describe('getPhaseColor', () => {
    it('returns default grey for pending', () => {
      expect(getPhaseColor('pending')).toBe('rgba(136, 153, 170, 0.8)')
    })

    it('returns info blue for in_progress', () => {
      expect(getPhaseColor('in_progress')).toBe('#29B6F6')
    })

    it('returns info blue for printing', () => {
      expect(getPhaseColor('printing')).toBe('#29B6F6')
    })

    it('returns warning orange for qa_check', () => {
      expect(getPhaseColor('qa_check')).toBe('#FFA726')
    })

    it('returns primary blue for shipped', () => {
      expect(getPhaseColor('shipped')).toBe('#42A5F5')
    })

    it('returns primary blue for delivered', () => {
      expect(getPhaseColor('delivered')).toBe('#42A5F5')
    })

    it('returns success green for accepted', () => {
      expect(getPhaseColor('accepted')).toBe('#66BB6A')
    })

    it('returns error red for disputed', () => {
      expect(getPhaseColor('disputed')).toBe('#EF5350')
    })

    it('returns default grey for cancelled', () => {
      expect(getPhaseColor('cancelled')).toBe('rgba(136, 153, 170, 0.8)')
    })

    it('returns fallback grey for unknown status', () => {
      expect(getPhaseColor('nonexistent_status')).toBe('rgba(136, 153, 170, 0.6)')
    })

    it('returns fallback grey for empty string', () => {
      expect(getPhaseColor('')).toBe('rgba(136, 153, 170, 0.6)')
    })
  })

  // ── getStatusDescription ─────────────────────────────────────────────
  describe('getStatusDescription', () => {
    it('returns description for pending', () => {
      expect(getStatusDescription('pending')).toBe('Waiting to begin fulfillment')
    })

    it('returns description for in_progress', () => {
      expect(getStatusDescription('in_progress')).toBe('Fulfillment work has started')
    })

    it('returns description for printing', () => {
      expect(getStatusDescription('printing')).toBe('Item is being printed')
    })

    it('returns description for qa_check', () => {
      expect(getStatusDescription('qa_check')).toBe('Quality assurance review')
    })

    it('returns description for shipped', () => {
      expect(getStatusDescription('shipped')).toBe('Item has been shipped')
    })

    it('returns description for delivered', () => {
      expect(getStatusDescription('delivered')).toBe('Item has been delivered')
    })

    it('returns description for accepted', () => {
      expect(getStatusDescription('accepted')).toBe('Buyer accepted the item')
    })

    it('returns description for disputed', () => {
      expect(getStatusDescription('disputed')).toBe('Buyer disputed the item')
    })

    it('returns description for cancelled', () => {
      expect(getStatusDescription('cancelled')).toBe('Claim was cancelled')
    })

    it('returns the status itself for unknown status', () => {
      expect(getStatusDescription('some_unknown_status')).toBe('some_unknown_status')
    })

    it('returns empty string for empty string input', () => {
      expect(getStatusDescription('')).toBe('')
    })
  })

  // ── getStatusLabel ───────────────────────────────────────────────────
  describe('getStatusLabel', () => {
    it('converts in_progress to "In Progress"', () => {
      expect(getStatusLabel('in_progress')).toBe('In Progress')
    })

    it('converts qa_check to "Qa Check"', () => {
      expect(getStatusLabel('qa_check')).toBe('Qa Check')
    })

    it('converts pending to "Pending"', () => {
      expect(getStatusLabel('pending')).toBe('Pending')
    })

    it('converts shipped to "Shipped"', () => {
      expect(getStatusLabel('shipped')).toBe('Shipped')
    })

    it('converts resolved_accepted to "Resolved Accepted"', () => {
      expect(getStatusLabel('resolved_accepted')).toBe('Resolved Accepted')
    })

    it('handles single word with no underscores', () => {
      expect(getStatusLabel('accepted')).toBe('Accepted')
    })

    it('handles empty string', () => {
      expect(getStatusLabel('')).toBe('')
    })
  })
})
