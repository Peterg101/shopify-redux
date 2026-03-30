import { useEffect, useRef, useState, useCallback } from 'react'
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
import { STATUS_PHASES } from './ClaimDashboardHeader'
import { borderSubtle, borderHover } from '../../theme'

export type ClaimViewMode = 'grid' | 'list'
export type ClaimSortOption = 'newest' | 'oldest' | 'status' | 'value_desc'

interface ClaimToolbarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  statusFilter: string[]
  onStatusFilterChange: (statuses: string[]) => void
  sortBy: ClaimSortOption
  onSortChange: (sort: ClaimSortOption) => void
  viewMode: ClaimViewMode
  onViewModeChange: (mode: ClaimViewMode) => void
  resultCount: number
}

export function ClaimToolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  resultCount,
}: ClaimToolbarProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      onSearchChange(localSearch)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [localSearch, onSearchChange])

  const handleViewChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newView: ClaimViewMode | null) => {
      if (newView) {
        onViewModeChange(newView)
        localStorage.setItem('claimed-view', newView)
      }
    },
    [onViewModeChange]
  )

  // Build the phase label list for the status filter select
  const phaseLabels = STATUS_PHASES.map((p) => p.label)

  const hasActiveFilters = searchQuery || statusFilter.length > 0

  return (
    <Box sx={{ mb: 3, px: 2.5 }}>
      {/* Main toolbar row */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        {/* Search */}
        <TextField
          size="small"
          placeholder="Search claims..."
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

        {/* Status filter */}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select
            multiple
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as string[])}
            input={<OutlinedInput label="Status" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
                {selected.map((val) => (
                  <Chip key={val} label={val} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                ))}
              </Box>
            )}
          >
            {phaseLabels.map((label) => (
              <MenuItem key={label} value={label}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Sort */}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Sort</InputLabel>
          <Select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as ClaimSortOption)}
            label="Sort"
          >
            <MenuItem value="newest">Newest</MenuItem>
            <MenuItem value="oldest">Oldest</MenuItem>
            <MenuItem value="status">Status</MenuItem>
            <MenuItem value="value_desc">Value: High → Low</MenuItem>
          </Select>
        </FormControl>

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Results count */}
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          Showing {resultCount} claim{resultCount !== 1 ? 's' : ''}
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
              borderColor: borderSubtle,
              '&.Mui-selected': {
                bgcolor: borderSubtle,
                color: '#00E5FF',
                borderColor: borderHover,
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
          {statusFilter.map((status) => (
            <Chip
              key={status}
              label={status}
              size="small"
              onDelete={() => onStatusFilterChange(statusFilter.filter((s) => s !== status))}
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
              onStatusFilterChange([])
            }}
            sx={{ fontSize: '0.75rem', borderColor: borderHover, color: '#00E5FF' }}
          />
        </Stack>
      )}
    </Box>
  )
}
