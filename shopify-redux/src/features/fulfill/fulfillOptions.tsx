import { useState, useCallback } from 'react'
import { Box, Container, Paper, Typography, Button, Stack } from '@mui/material'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import FilterListOffIcon from '@mui/icons-material/FilterListOff'
import { useSelector } from 'react-redux'
import { RootState } from '../../app/store'
import { visibleOrders } from '../../app/utility/utils'
import { Order } from '../../app/utility/interfaces'
import { useGetUserClaimableQuery } from '../../services/authApi'
import { MarketplaceToolbar, ViewMode, SortOption } from './MarketplaceToolbar'
import { MarketplaceGridCard } from './MarketplaceGridCard'
import { MarketplaceListCard } from './MarketplaceListCard'
import { MarketplaceCompactCard } from './MarketplaceCompactCard'
import { SkeletonGrid } from './CardSkeleton'

function applyFilters(
  orders: Order[],
  searchQuery: string,
  materialFilter: string[],
  techniqueFilter: string[]
): Order[] {
  let result = orders

  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    result = result.filter((o) => o.name.toLowerCase().includes(q))
  }

  if (materialFilter.length > 0) {
    result = result.filter((o) => materialFilter.includes(o.material))
  }

  if (techniqueFilter.length > 0) {
    result = result.filter((o) => techniqueFilter.includes(o.technique))
  }

  return result
}

function applySort(orders: Order[], sortBy: SortOption): Order[] {
  const sorted = [...orders]
  switch (sortBy) {
    case 'newest':
      return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    case 'price_asc': {
      const perUnit = (o: Order) => (o.quantity > 0 ? o.price / o.quantity : 0)
      return sorted.sort((a, b) => perUnit(a) - perUnit(b))
    }
    case 'price_desc': {
      const perUnit = (o: Order) => (o.quantity > 0 ? o.price / o.quantity : 0)
      return sorted.sort((a, b) => perUnit(b) - perUnit(a))
    }
    case 'most_needed':
      return sorted.sort((a, b) => (b.quantity - b.quantity_claimed) - (a.quantity - a.quantity_claimed))
    default:
      return sorted
  }
}

export const FulfillOptions = () => {
  const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState)
  const { data: claimableOrders = [] } = useGetUserClaimableQuery()

  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem('marketplace-view') as ViewMode) || 'grid'
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [materialFilter, setMaterialFilter] = useState<string[]>([])
  const [techniqueFilter, setTechniqueFilter] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<SortOption>('newest')

  const handleSearchChange = useCallback((q: string) => setSearchQuery(q), [])
  const handleMaterialChange = useCallback((m: string[]) => setMaterialFilter(m), [])
  const handleTechniqueChange = useCallback((t: string[]) => setTechniqueFilter(t), [])
  const handleSortChange = useCallback((s: SortOption) => setSortBy(s), [])
  const handleViewChange = useCallback((v: ViewMode) => setViewMode(v), [])

  if (!userInterfaceState.userInformation?.user?.user_id) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Paper sx={{ p: 2, minHeight: '60vh' }}>
          <SkeletonGrid />
        </Paper>
      </Container>
    )
  }

  const allOrders = visibleOrders(
    userInterfaceState.userInformation.user,
    claimableOrders
  )

  const filtered = applyFilters(allOrders, searchQuery, materialFilter, techniqueFilter)
  const sorted = applySort(filtered, sortBy)
  const hasActiveFilters = !!(searchQuery || materialFilter.length > 0 || techniqueFilter.length > 0)

  return (
    <Box>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 2, minHeight: '60vh' }}>
          <MarketplaceToolbar
            orders={allOrders}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            materialFilter={materialFilter}
            onMaterialFilterChange={handleMaterialChange}
            techniqueFilter={techniqueFilter}
            onTechniqueFilterChange={handleTechniqueChange}
            sortBy={sortBy}
            onSortChange={handleSortChange}
            viewMode={viewMode}
            onViewModeChange={handleViewChange}
            resultCount={sorted.length}
          />

          {sorted.length === 0 ? (
            <EmptyState hasFilters={hasActiveFilters} onClearFilters={() => {
              setSearchQuery('')
              setMaterialFilter([])
              setTechniqueFilter([])
            }} />
          ) : viewMode === 'grid' ? (
            <GridView orders={sorted} />
          ) : viewMode === 'list' ? (
            <ListView orders={sorted} />
          ) : (
            <CompactView orders={sorted} />
          )}
        </Paper>
      </Container>
    </Box>
  )
}

const GridView = ({ orders }: { orders: Order[] }) => (
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
    {orders.map((order) => (
      <MarketplaceGridCard key={order.order_id} order={order} />
    ))}
  </Box>
)

const ListView = ({ orders }: { orders: Order[] }) => (
  <Stack spacing={1.5}>
    {orders.map((order) => (
      <MarketplaceListCard key={order.order_id} order={order} />
    ))}
  </Stack>
)

const CompactView = ({ orders }: { orders: Order[] }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: {
        xs: 'repeat(2, 1fr)',
        sm: 'repeat(3, 1fr)',
        md: 'repeat(4, 1fr)',
        lg: 'repeat(6, 1fr)',
      },
      gap: 1.5,
    }}
  >
    {orders.map((order) => (
      <MarketplaceCompactCard key={order.order_id} order={order} />
    ))}
  </Box>
)

const EmptyState = ({
  hasFilters,
  onClearFilters,
}: {
  hasFilters: boolean
  onClearFilters: () => void
}) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      py: 8,
      gap: 2,
    }}
  >
    {hasFilters ? (
      <>
        <FilterListOffIcon sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.5 }} />
        <Typography variant="h6" align="center" color="text.secondary">
          No orders match your filters.
        </Typography>
        <Button variant="outlined" size="small" onClick={onClearFilters}>
          Clear all filters
        </Button>
      </>
    ) : (
      <>
        <StorefrontOutlinedIcon sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.5 }} />
        <Typography variant="h6" align="center" color="text.secondary">
          No orders available right now.
        </Typography>
        <Typography variant="body2" align="center" color="text.secondary">
          New orders appear here when buyers submit collaborative prints.
        </Typography>
      </>
    )}
  </Box>
)
