import { STATUS_PHASES } from '../../features/fulfill/ClaimDashboardHeader'

export const getScarcityColor = (remaining: number, total: number): string => {
  if (total <= 0) return '#FF5252'
  const ratio = remaining / total
  if (ratio <= 0.25 || remaining <= 3) return '#FF5252'
  if (ratio <= 0.5) return '#FF9100'
  return '#00E5FF'
}

export const getPhaseIndex = (status: string): number => {
  const idx = STATUS_PHASES.findIndex((p) => p.statuses.includes(status))
  return idx >= 0 ? idx : 0
}

export const getPhaseColor = (status: string): string => {
  const phase = STATUS_PHASES.find((p) => p.statuses.includes(status))
  if (!phase) return 'rgba(136, 153, 170, 0.6)'
  const colorMap: Record<string, string> = {
    default: 'rgba(136, 153, 170, 0.8)',
    info: '#29B6F6',
    warning: '#FFA726',
    primary: '#42A5F5',
    success: '#66BB6A',
    error: '#EF5350',
  }
  return colorMap[phase.color] || 'rgba(136, 153, 170, 0.6)'
}

const STATUS_DESCRIPTIONS: Record<string, string> = {
  pending: 'Waiting to begin fulfillment',
  in_progress: 'Fulfillment work has started',
  printing: 'Item is being printed',
  qa_check: 'Quality assurance review',
  shipped: 'Item has been shipped',
  delivered: 'Item has been delivered',
  accepted: 'Buyer accepted the item',
  disputed: 'Buyer disputed the item',
  cancelled: 'Claim was cancelled',
}

export const getStatusDescription = (status: string): string => {
  return STATUS_DESCRIPTIONS[status] || status
}

export const getStatusLabel = (status: string): string => {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
