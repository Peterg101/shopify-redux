import { useState, useMemo, useCallback } from 'react'
import { Box, Typography, Container, Paper, Stack } from '@mui/material'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import FilterListOffIcon from '@mui/icons-material/FilterListOff'
import { Claim } from '../../app/utility/interfaces'
import { useGetUserClaimsQuery } from '../../services/authApi'
import { ClaimDashboardHeader, STATUS_PHASES } from './ClaimDashboardHeader'
import { ClaimToolbar, ClaimViewMode, ClaimSortOption } from './ClaimToolbar'
import { ClaimGridCard } from './ClaimGridCard'
import { ClaimListCard } from './ClaimListCard'

const getPhaseIndex = (status: string): number => {
  const idx = STATUS_PHASES.findIndex((p) => p.statuses.includes(status))
  return idx >= 0 ? idx : 0
}

const applyFilters = (
  claims: Claim[],
  searchQuery: string,
  statusFilter: string[]
): Claim[] => {
  let filtered = claims

  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter((c) => c.order.name.toLowerCase().includes(q))
  }

  if (statusFilter.length > 0) {
    const allowedStatuses = STATUS_PHASES
      .filter((p) => statusFilter.includes(p.label))
      .flatMap((p) => p.statuses)
    filtered = filtered.filter((c) => allowedStatuses.includes(c.status))
  }

  return filtered
}

const applySort = (claims: Claim[], sortBy: ClaimSortOption): Claim[] => {
  const sorted = [...claims]
  switch (sortBy) {
    case 'newest':
      return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    case 'status':
      return sorted.sort((a, b) => getPhaseIndex(a.status) - getPhaseIndex(b.status))
    case 'value_desc': {
      const getValue = (c: Claim) => {
        const ppu = c.order.quantity > 0 ? c.order.price / c.order.quantity : 0
        return ppu * c.quantity
      }
      return sorted.sort((a, b) => getValue(b) - getValue(a))
    }
    default:
      return sorted
  }
}

export const ClaimedItems = () => {
  const { data: claims = [] } = useGetUserClaimsQuery()

  const [viewMode, setViewMode] = useState<ClaimViewMode>(
    () => (localStorage.getItem('claimed-view') as ClaimViewMode) || 'grid'
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<ClaimSortOption>('newest')

  const handlePhaseClick = useCallback((statuses: string[]) => {
    const phase = STATUS_PHASES.find((p) =>
      p.statuses.length === statuses.length && p.statuses.every((s) => statuses.includes(s))
    )
    if (phase) {
      setStatusFilter((prev) =>
        prev.includes(phase.label)
          ? prev.filter((l) => l !== phase.label)
          : [phase.label]
      )
    }
  }, [])

  const filtered = useMemo(
    () => applyFilters(claims, searchQuery, statusFilter),
    [claims, searchQuery, statusFilter]
  )
  const sorted = useMemo(() => applySort(filtered, sortBy), [filtered, sortBy])

  const hasFilters = searchQuery || statusFilter.length > 0

  // Empty state: no claims at all
  if (claims.length === 0) {
    return (
      <Box>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Paper>
            <Stack alignItems="center" spacing={2} sx={{ py: 8, px: 3 }}>
              <AssignmentOutlinedIcon sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.4 }} />
              <Typography variant="h6" color="text.secondary" align="center">
                You haven't claimed any orders yet.
              </Typography>
              <Typography variant="body2" color="text.secondary" align="center">
                Head to the Available to Fulfill tab to browse and claim orders.
              </Typography>
            </Stack>
          </Paper>
        </Container>
      </Box>
    )
  }

  return (
    <Box>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper>
          <ClaimDashboardHeader claims={claims} onPhaseClick={handlePhaseClick} />

          <ClaimToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            resultCount={sorted.length}
          />

          <Box sx={{ px: 2.5, pb: 2.5 }}>
            {sorted.length === 0 && hasFilters ? (
              <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
                <FilterListOffIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.4 }} />
                <Typography variant="body1" color="text.secondary" align="center">
                  No claims match your filters.
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: '#00E5FF', cursor: 'pointer' }}
                  onClick={() => {
                    setSearchQuery('')
                    setStatusFilter([])
                  }}
                >
                  Clear all filters
                </Typography>
              </Stack>
            ) : viewMode === 'grid' ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, 1fr)',
                    md: 'repeat(3, 1fr)',
                    lg: 'repeat(4, 1fr)',
                  },
                  gap: 2,
                }}
              >
                {sorted.map((claim) => (
                  <ClaimGridCard key={claim.id} claim={claim} />
                ))}
              </Box>
            ) : (
              <Stack spacing={1.5}>
                {sorted.map((claim) => (
                  <ClaimListCard key={claim.id} claim={claim} />
                ))}
              </Stack>
            )}
          </Box>
        </Paper>
      </Container>
    </Box>
  )
}
