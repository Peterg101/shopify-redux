import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  Box,
  TextField,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Chip,
  InputAdornment,
  FormControl,
  InputLabel,
  OutlinedInput,
  Stack,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import ViewListIcon from '@mui/icons-material/ViewList'
import ViewComfyIcon from '@mui/icons-material/ViewComfy'
import { Order } from '../../app/utility/interfaces'

export type ViewMode = 'grid' | 'list' | 'compact'
export type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'most_needed'

interface MarketplaceToolbarProps {
  orders: Order[]
  searchQuery: string
  onSearchChange: (query: string) => void
  materialFilter: string[]
  onMaterialFilterChange: (materials: string[]) => void
  techniqueFilter: string[]
  onTechniqueFilterChange: (techniques: string[]) => void
  sortBy: SortOption
  onSortChange: (sort: SortOption) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  resultCount: number
}

export function MarketplaceToolbar({
  orders,
  searchQuery,
  onSearchChange,
  materialFilter,
  onMaterialFilterChange,
  techniqueFilter,
  onTechniqueFilterChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  resultCount,
}: MarketplaceToolbarProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const availableMaterials = useMemo(
    () => Array.from(new Set(orders.map((o) => o.material))).sort(),
    [orders]
  )

  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      onSearchChange(localSearch)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [localSearch, onSearchChange])

  const handleViewChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newView: ViewMode | null) => {
      if (newView) {
        onViewModeChange(newView)
        localStorage.setItem('marketplace-view', newView)
      }
    },
    [onViewModeChange]
  )

  const handleTechniqueChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newTechniques: string[]) => {
      onTechniqueFilterChange(newTechniques)
    },
    [onTechniqueFilterChange]
  )

  const hasActiveFilters = searchQuery || materialFilter.length > 0 || techniqueFilter.length > 0

  return (
    <Box sx={{ mb: 3 }}>
      {/* Main toolbar row */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          alignItems: 'center',
        }}
      >
        {/* Search */}
        <TextField
          size="small"
          placeholder="Search orders..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 200, flex: { xs: '1 1 100%', sm: '0 1 auto' } }}
        />

        {/* Material filter */}
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Material</InputLabel>
          <Select
            multiple
            value={materialFilter}
            onChange={(e) => onMaterialFilterChange(e.target.value as string[])}
            input={<OutlinedInput label="Material" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
                {selected.map((val) => (
                  <Chip key={val} label={val} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                ))}
              </Box>
            )}
          >
            {availableMaterials.map((mat) => (
              <MenuItem key={mat} value={mat}>
                {mat}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Technique toggle */}
        <ToggleButtonGroup
          size="small"
          value={techniqueFilter}
          onChange={handleTechniqueChange}
          sx={{
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              px: 1.5,
              py: 0.5,
              fontSize: '0.8rem',
              borderColor: 'rgba(0, 229, 255, 0.12)',
              '&.Mui-selected': {
                bgcolor: 'rgba(0, 229, 255, 0.12)',
                color: '#00E5FF',
                borderColor: 'rgba(0, 229, 255, 0.3)',
              },
            },
          }}
        >
          <ToggleButton value="FDM">FDM</ToggleButton>
          <ToggleButton value="Resin">Resin</ToggleButton>
        </ToggleButtonGroup>

        {/* Sort */}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Sort</InputLabel>
          <Select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            label="Sort"
          >
            <MenuItem value="newest">Newest</MenuItem>
            <MenuItem value="price_asc">Price: Low → High</MenuItem>
            <MenuItem value="price_desc">Price: High → Low</MenuItem>
            <MenuItem value="most_needed">Most Needed</MenuItem>
          </Select>
        </FormControl>

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Results count */}
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          Showing {resultCount} order{resultCount !== 1 ? 's' : ''}
        </Typography>

        {/* View toggle */}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={viewMode}
          onChange={handleViewChange}
          sx={{
            '& .MuiToggleButton-root': {
              px: 1,
              py: 0.5,
              borderColor: 'rgba(0, 229, 255, 0.12)',
              '&.Mui-selected': {
                bgcolor: 'rgba(0, 229, 255, 0.12)',
                color: '#00E5FF',
                borderColor: 'rgba(0, 229, 255, 0.3)',
              },
            },
          }}
        >
          <ToggleButton value="grid" aria-label="grid view">
            <ViewModuleIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="list" aria-label="list view">
            <ViewListIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="compact" aria-label="compact view">
            <ViewComfyIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Active filters row */}
      {hasActiveFilters && (
        <Stack direction="row" spacing={0.5} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
          {searchQuery && (
            <Chip
              label={`Search: "${searchQuery}"`}
              size="small"
              onDelete={() => {
                setLocalSearch('')
                onSearchChange('')
              }}
              sx={{ fontSize: '0.75rem' }}
            />
          )}
          {materialFilter.map((mat) => (
            <Chip
              key={mat}
              label={mat}
              size="small"
              onDelete={() => onMaterialFilterChange(materialFilter.filter((m) => m !== mat))}
              sx={{ fontSize: '0.75rem' }}
            />
          ))}
          {techniqueFilter.map((tech) => (
            <Chip
              key={tech}
              label={tech}
              size="small"
              onDelete={() => onTechniqueFilterChange(techniqueFilter.filter((t) => t !== tech))}
              sx={{ fontSize: '0.75rem' }}
            />
          ))}
          <Chip
            label="Clear all"
            size="small"
            variant="outlined"
            onClick={() => {
              setLocalSearch('')
              onSearchChange('')
              onMaterialFilterChange([])
              onTechniqueFilterChange([])
            }}
            sx={{ fontSize: '0.75rem', borderColor: 'rgba(0, 229, 255, 0.3)', color: '#00E5FF' }}
          />
        </Stack>
      )}
    </Box>
  )
}
