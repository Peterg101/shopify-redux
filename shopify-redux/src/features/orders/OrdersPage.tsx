import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Chip, CircularProgress,
  TextField, InputAdornment, IconButton, Grid, Pagination,
  ToggleButton, ToggleButtonGroup, FormControl, InputLabel,
  Select, MenuItem, SelectChangeEvent,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewComfyIcon from '@mui/icons-material/ViewComfy';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import { useGetUserOrdersQuery, useGetUserClaimsQuery } from '../../services/authApi';
import { HeaderBar } from '../userInterface/headerBar';
import { ClaimChat } from '../messaging/ClaimChat';
import { Order, Claim } from '../../app/utility/interfaces';
import {
  borderSubtle, borderHover, glowSubtle, glowMedium,
  bgHighlight, bgHighlightHover, monoFontFamily, statusColors,
} from '../../theme';

// ── Constants ────────────────────────────────────────────────────────

type ViewMode = 'grid' | 'list' | 'compact';
type SortOption = 'newest' | 'oldest' | 'price_high' | 'price_low';
type TabMode = 'orders' | 'claims';

const ITEMS_PER_PAGE = 12;
const LS_VIEW_KEY = 'fitd_orders_view_mode';
const MEDIA_URL = process.env.REACT_APP_MEDIA_URL || 'http://localhost:1235';

const GLASS_BG = 'rgba(19, 25, 32, 0.85)';
const GLASS_BLUR = 'blur(12px)';

// ── Normalised item for rendering ────────────────────────────────────

interface NormalisedItem {
  id: string;
  name: string;
  material: string;
  technique: string;
  price: number;
  quantity: number;
  quantity_claimed: number;
  status: string;
  created_at: string;
  task_id?: string;
  claims?: Claim[];
  navigateTo: string;
  source: TabMode;
}

function normaliseOrder(order: Order): NormalisedItem {
  return {
    id: order.order_id,
    name: order.name,
    material: order.material,
    technique: order.technique,
    price: order.price,
    quantity: order.quantity,
    quantity_claimed: order.quantity_claimed,
    status: order.status,
    created_at: order.created_at,
    task_id: order.task_id,
    claims: order.claims,
    navigateTo: `/orders/${order.order_id}`,
    source: 'orders',
  };
}

function normaliseClaim(claim: Claim): NormalisedItem {
  const o = claim.order;
  return {
    id: claim.id,
    name: o?.name ?? 'Unknown Order',
    material: o?.material ?? '',
    technique: o?.technique ?? '',
    price: o?.price ?? 0,
    quantity: claim.quantity,
    quantity_claimed: o?.quantity_claimed ?? 0,
    status: claim.status,
    created_at: claim.created_at,
    task_id: o?.task_id,
    claims: undefined,
    navigateTo: `/claim/${claim.id}`,
    source: 'claims',
  };
}

// ── Sorting ──────────────────────────────────────────────────────────

function sortItems(items: NormalisedItem[], sort: SortOption): NormalisedItem[] {
  const sorted = [...items];
  switch (sort) {
    case 'newest':
      return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    case 'price_high':
      return sorted.sort((a, b) => b.price - a.price);
    case 'price_low':
      return sorted.sort((a, b) => a.price - b.price);
    default:
      return sorted;
  }
}

// ── Status chip helper ───────────────────────────────────────────────

const StatusChip = ({ status }: { status: string }) => {
  const color = statusColors[status as keyof typeof statusColors] || '#8899AA';
  return (
    <Chip
      label={status.replace(/_/g, ' ')}
      size="small"
      sx={{
        height: 22, fontSize: '0.7rem', fontWeight: 600,
        textTransform: 'capitalize',
        backgroundColor: `${color}18`,
        color,
        border: `1px solid ${color}35`,
      }}
    />
  );
};

// ── Thumbnail component ──────────────────────────────────────────────

const Thumbnail = ({ taskId, height, width }: { taskId?: string; height: number; width?: number | string }) => {
  const [failed, setFailed] = useState(false);

  if (!taskId || failed) {
    return (
      <Box sx={{
        height, width: width ?? '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `linear-gradient(135deg, rgba(0,229,255,0.05) 0%, rgba(0,229,255,0.02) 100%)`,
        borderRadius: 1, flexShrink: 0,
      }}>
        <ShoppingBagOutlinedIcon sx={{ fontSize: 32, color: 'text.secondary', opacity: 0.3 }} />
      </Box>
    );
  }

  return (
    <Box
      component="img"
      src={`${MEDIA_URL}/thumbnail/${taskId}`}
      alt="Order thumbnail"
      onError={() => setFailed(true)}
      sx={{
        height, width: width ?? '100%',
        objectFit: 'cover', borderRadius: 1, flexShrink: 0,
      }}
    />
  );
};

// ── Progress bar ─────────────────────────────────────────────────────

const ProgressBar = ({ claimed, total }: { claimed: number; total: number }) => {
  if (claimed <= 0 || total <= 0) return null;
  const pct = Math.min((claimed / total) * 100, 100);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ flex: 1, height: 3, backgroundColor: glowSubtle, borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${pct}%`, backgroundColor: '#00E5FF', borderRadius: 2, transition: 'width 0.3s ease' }} />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: monoFontFamily, fontSize: '0.65rem' }}>
        {claimed}/{total}
      </Typography>
    </Box>
  );
};

// ── Claims row (for "My Orders" tab) ────────────────────────────────

const ClaimsRow = ({ claims, onChat }: { claims?: Claim[]; onChat: (claimId: string) => void }) => {
  if (!claims || claims.length === 0) return null;
  return (
    <Box sx={{ borderTop: `1px solid ${borderSubtle}`, px: 2, py: 1.5 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
          Claims:
        </Typography>
        {claims.map((claim: any) => {
          const claimColor = statusColors[claim.status as keyof typeof statusColors] || '#8899AA';
          return (
            <Box key={claim.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Chip
                label={`${claim.claimant_username || 'Fulfiller'} \u00B7 ${claim.status.replace(/_/g, ' ')}`}
                size="small"
                sx={{
                  height: 24, fontSize: '0.7rem',
                  backgroundColor: `${claimColor}12`, color: claimColor,
                  border: `1px solid ${claimColor}25`, textTransform: 'capitalize',
                }}
              />
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onChat(claim.id); }}
                sx={{ width: 28, height: 28, color: '#00E5FF', '&:hover': { backgroundColor: bgHighlight } }}
              >
                <ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

// ── Grid Card ────────────────────────────────────────────────────────

const GridCard = ({ item, onClick, onChat }: { item: NormalisedItem; onClick: () => void; onChat: (id: string) => void }) => (
  <Box
    sx={{
      borderRadius: 3, border: `1px solid ${borderSubtle}`,
      background: GLASS_BG, backdropFilter: GLASS_BLUR,
      overflow: 'hidden', transition: 'all 0.2s ease', cursor: 'pointer',
      '&:hover': { borderColor: borderHover, boxShadow: `0 0 20px ${glowSubtle}` },
    }}
  >
    <Box onClick={onClick}>
      <Thumbnail taskId={item.task_id} height={140} />
      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
          <Typography variant="body1" fontWeight={700} noWrap sx={{ flex: 1, mr: 1 }}>
            {item.name}
          </Typography>
          <StatusChip status={item.status} />
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1 }}>
          <Chip label={item.material} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.7rem', borderColor: borderSubtle }} />
          <Chip label={item.technique} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.7rem', borderColor: borderSubtle }} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" sx={{ fontFamily: monoFontFamily, color: '#00E5FF', fontWeight: 600 }}>
            {'\u00A3'}{item.price?.toFixed(2)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {'\u00D7'}{item.quantity}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {new Date(item.created_at).toLocaleDateString()}
          </Typography>
        </Box>
        {item.source === 'orders' && (
          <ProgressBar claimed={item.quantity_claimed} total={item.quantity} />
        )}
      </Box>
    </Box>
    {item.source === 'orders' && <ClaimsRow claims={item.claims} onChat={onChat} />}
    {item.source === 'claims' && (
      <Box sx={{ borderTop: `1px solid ${borderSubtle}`, px: 2, py: 1 }}>
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onChat(item.id); }}
          sx={{ color: '#00E5FF', '&:hover': { backgroundColor: bgHighlight } }}
        >
          <ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    )}
  </Box>
);

// ── List Card ────────────────────────────────────────────────────────

const ListCard = ({ item, onClick, onChat }: { item: NormalisedItem; onClick: () => void; onChat: (id: string) => void }) => (
  <Box
    sx={{
      borderRadius: 3, border: `1px solid ${borderSubtle}`,
      background: GLASS_BG, backdropFilter: GLASS_BLUR,
      overflow: 'hidden', transition: 'all 0.2s ease',
      '&:hover': { borderColor: borderHover, boxShadow: `0 0 20px ${glowSubtle}` },
    }}
  >
    <Box
      onClick={onClick}
      sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 2, cursor: 'pointer' }}
    >
      <Thumbnail taskId={item.task_id} height={80} width={80} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <Typography variant="body1" fontWeight={700} noWrap sx={{ flex: 1 }}>
            {item.name}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            {item.material} {'\u00B7'} {item.technique}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {'\u00D7'}{item.quantity}
          </Typography>
        </Box>
        {item.source === 'orders' && (
          <Box sx={{ mt: 0.5, maxWidth: 200 }}>
            <ProgressBar claimed={item.quantity_claimed} total={item.quantity} />
          </Box>
        )}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
        <StatusChip status={item.status} />
        <Typography variant="body2" sx={{ fontFamily: monoFontFamily, color: '#00E5FF', fontWeight: 600 }}>
          {'\u00A3'}{item.price?.toFixed(2)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {new Date(item.created_at).toLocaleDateString()}
        </Typography>
      </Box>
    </Box>
    {item.source === 'orders' && <ClaimsRow claims={item.claims} onChat={onChat} />}
    {item.source === 'claims' && (
      <Box sx={{ borderTop: `1px solid ${borderSubtle}`, px: 2.5, py: 1 }}>
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onChat(item.id); }}
          sx={{ color: '#00E5FF', '&:hover': { backgroundColor: bgHighlight } }}
        >
          <ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    )}
  </Box>
);

// ── Compact Row ──────────────────────────────────────────────────────

const CompactRow = ({ item, onClick, onChat }: { item: NormalisedItem; onClick: () => void; onChat: (id: string) => void }) => {
  const color = statusColors[item.status as keyof typeof statusColors] || '#8899AA';
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 2,
        px: 2.5, py: 1.5, cursor: 'pointer',
        borderBottom: `1px solid ${borderSubtle}`,
        transition: 'background 0.15s ease',
        '&:hover': { background: bgHighlightHover },
      }}
    >
      {/* Status dot */}
      <Box sx={{
        width: 8, height: 8, borderRadius: '50%',
        backgroundColor: color, flexShrink: 0,
        boxShadow: `0 0 6px ${color}60`,
      }} />

      <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1, minWidth: 0 }}>
        {item.name}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80 }}>
        {item.material}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 40 }}>
        {'\u00D7'}{item.quantity}
      </Typography>
      <Typography variant="body2" sx={{ fontFamily: monoFontFamily, color: '#00E5FF', fontWeight: 600, minWidth: 70, textAlign: 'right' }}>
        {'\u00A3'}{item.price?.toFixed(2)}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80, textAlign: 'right' }}>
        {new Date(item.created_at).toLocaleDateString()}
      </Typography>
      <Box sx={{ minWidth: 90, display: 'flex', justifyContent: 'flex-end' }}>
        <StatusChip status={item.status} />
      </Box>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          if (item.source === 'claims') {
            onChat(item.id);
          } else if (item.claims && item.claims.length > 0) {
            onChat(item.claims[0].id);
          }
        }}
        sx={{
          width: 28, height: 28, color: '#00E5FF',
          visibility: (item.source === 'claims' || (item.claims && item.claims.length > 0)) ? 'visible' : 'hidden',
          '&:hover': { backgroundColor: bgHighlight },
        }}
      >
        <ChatBubbleOutlineIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Box>
  );
};

// ── Main Component ───────────────────────────────────────────────────

export const OrdersPage = () => {
  const navigate = useNavigate();
  const { data: orders = [], isLoading: ordersLoading } = useGetUserOrdersQuery();
  const { data: claims = [], isLoading: claimsLoading } = useGetUserClaimsQuery();

  const [activeTab, setActiveTab] = useState<TabMode>('orders');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem(LS_VIEW_KEY) as ViewMode) || 'grid'
  );
  const [page, setPage] = useState(1);
  const [chatClaimId, setChatClaimId] = useState<string | null>(null);

  const isLoading = activeTab === 'orders' ? ordersLoading : claimsLoading;

  // Normalise data based on active tab
  const allItems: NormalisedItem[] = useMemo(() => {
    if (activeTab === 'orders') {
      return orders.map(normaliseOrder);
    }
    return claims.map(normaliseClaim);
  }, [activeTab, orders, claims]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return allItems;
    const q = search.toLowerCase();
    return allItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.material.toLowerCase().includes(q) ||
        item.technique.toLowerCase().includes(q)
    );
  }, [allItems, search]);

  // Sort
  const sorted = useMemo(() => sortItems(filtered, sortBy), [filtered, sortBy]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => sorted.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE),
    [sorted, safePage]
  );

  // Handlers
  const handleViewChange = useCallback((_: React.MouseEvent<HTMLElement>, newView: ViewMode | null) => {
    if (newView) {
      setViewMode(newView);
      localStorage.setItem(LS_VIEW_KEY, newView);
    }
  }, []);

  const handleTabChange = useCallback((_: React.MouseEvent<HTMLElement>, newTab: TabMode | null) => {
    if (newTab) {
      setActiveTab(newTab);
      setPage(1);
      setSearch('');
    }
  }, []);

  const handleSortChange = useCallback((e: SelectChangeEvent<SortOption>) => {
    setSortBy(e.target.value as SortOption);
    setPage(1);
  }, []);

  const handleChat = useCallback((claimId: string) => setChatClaimId(claimId), []);

  const handleItemClick = useCallback((item: NormalisedItem) => {
    navigate(item.navigateTo);
  }, [navigate]);

  const totalCount = allItems.length;
  const activeLabel = activeTab === 'orders' ? 'My Orders' : 'My Claims';
  const subtitle = activeTab === 'orders'
    ? 'Track your manufacturing orders and communicate with fulfillers.'
    : 'Manage orders you are fulfilling as a manufacturer.';

  return (
    <Box>
      <HeaderBar />
      <Container maxWidth="lg" sx={{ pt: 12, pb: 8 }}>

        {/* ── Header ──────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <IconButton onClick={() => navigate(-1)} size="small" sx={{ color: 'text.secondary' }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
            {activeLabel}
          </Typography>
          <Chip
            label={totalCount}
            size="small"
            sx={{
              height: 24, fontFamily: monoFontFamily, fontWeight: 700,
              backgroundColor: 'rgba(0, 229, 255, 0.12)', color: '#00E5FF',
            }}
          />
        </Box>
        <Typography variant="body1" color="text.secondary" sx={{ ml: 6, mb: 3 }}>
          {subtitle}
        </Typography>

        {/* ── Tab Toggle ──────────────────────────────────────── */}
        <ToggleButtonGroup
          exclusive
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            mb: 3,
            '& .MuiToggleButton-root': {
              textTransform: 'none', px: 2.5, py: 1,
              borderColor: borderSubtle, gap: 1,
              '&.Mui-selected': {
                bgcolor: glowMedium, color: '#00E5FF',
                borderColor: borderHover,
              },
            },
          }}
        >
          <ToggleButton value="orders">
            <ShoppingBagOutlinedIcon sx={{ fontSize: 18 }} />
            My Orders
            <Chip label={orders.length} size="small" sx={{
              height: 20, fontSize: '0.7rem', fontWeight: 700, ml: 0.5,
              backgroundColor: activeTab === 'orders' ? 'rgba(0,229,255,0.2)' : 'rgba(136,153,170,0.15)',
              color: activeTab === 'orders' ? '#00E5FF' : 'text.secondary',
            }} />
          </ToggleButton>
          <ToggleButton value="claims">
            <BuildOutlinedIcon sx={{ fontSize: 18 }} />
            My Claims
            <Chip label={claims.length} size="small" sx={{
              height: 20, fontSize: '0.7rem', fontWeight: 700, ml: 0.5,
              backgroundColor: activeTab === 'claims' ? 'rgba(0,229,255,0.2)' : 'rgba(136,153,170,0.15)',
              color: activeTab === 'claims' ? '#00E5FF' : 'text.secondary',
            }} />
          </ToggleButton>
        </ToggleButtonGroup>

        {/* ── Search + Sort + View Mode (single row) ────────── */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 3 }}>
          <TextField
            size="small"
            placeholder={`Search ${activeTab === 'orders' ? 'orders' : 'claims'}...`}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1, minWidth: 200 }}
          />

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Sort</InputLabel>
            <Select value={sortBy} onChange={handleSortChange} label="Sort">
              <MenuItem value="newest">Newest</MenuItem>
              <MenuItem value="oldest">Oldest</MenuItem>
              <MenuItem value="price_high">Price: High {'\u2192'} Low</MenuItem>
              <MenuItem value="price_low">Price: Low {'\u2192'} High</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', display: { xs: 'none', md: 'block' } }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </Typography>

          <ToggleButtonGroup
            size="small"
            exclusive
            value={viewMode}
            onChange={handleViewChange}
            sx={{
              '& .MuiToggleButton-root': {
                px: 1, py: 0.5, borderColor: borderSubtle,
                '&.Mui-selected': { bgcolor: borderSubtle, color: '#00E5FF', borderColor: borderHover },
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

        {/* ── Loading ─────────────────────────────────────────── */}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {/* ── Empty States ────────────────────────────────────── */}
        {!isLoading && allItems.length === 0 && (
          <Box sx={{
            textAlign: 'center', py: 8,
            border: `1px solid ${borderSubtle}`, borderRadius: 3,
            background: GLASS_BG, backdropFilter: GLASS_BLUR,
          }}>
            <Typography variant="h6" color="text.secondary">
              {activeTab === 'orders'
                ? 'No orders yet'
                : 'No claimed orders'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {activeTab === 'orders'
                ? 'Upload a model to get started.'
                : 'Browse the marketplace to find orders to fulfil.'}
            </Typography>
          </Box>
        )}

        {/* No search results */}
        {!isLoading && search && filtered.length === 0 && allItems.length > 0 && (
          <Box sx={{
            textAlign: 'center', py: 6,
            border: `1px solid ${borderSubtle}`, borderRadius: 3,
            background: GLASS_BG, backdropFilter: GLASS_BLUR,
          }}>
            <Typography variant="body1" color="text.secondary">
              No {activeTab === 'orders' ? 'orders' : 'claims'} matching &ldquo;{search}&rdquo;
            </Typography>
          </Box>
        )}

        {/* ── Grid View ───────────────────────────────────────── */}
        {!isLoading && paginated.length > 0 && viewMode === 'grid' && (
          <Grid container spacing={2.5}>
            {paginated.map((item) => (
              <Grid item xs={12} md={6} lg={4} key={item.id}>
                <GridCard item={item} onClick={() => handleItemClick(item)} onChat={handleChat} />
              </Grid>
            ))}
          </Grid>
        )}

        {/* ── List View ───────────────────────────────────────── */}
        {!isLoading && paginated.length > 0 && viewMode === 'list' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {paginated.map((item) => (
              <ListCard key={item.id} item={item} onClick={() => handleItemClick(item)} onChat={handleChat} />
            ))}
          </Box>
        )}

        {/* ── Compact View ────────────────────────────────────── */}
        {!isLoading && paginated.length > 0 && viewMode === 'compact' && (
          <Box sx={{
            borderRadius: 3, border: `1px solid ${borderSubtle}`,
            background: GLASS_BG, backdropFilter: GLASS_BLUR,
            overflow: 'hidden',
          }}>
            {/* Header row */}
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 2,
              px: 2.5, py: 1, borderBottom: `1px solid ${borderSubtle}`,
            }}>
              <Box sx={{ width: 8 }} />
              <Typography variant="caption" color="text.secondary" sx={{ flex: 1, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                Name
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                Material
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 40, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                Qty
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em', textAlign: 'right' }}>
                Price
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em', textAlign: 'right' }}>
                Date
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 90, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em', textAlign: 'right' }}>
                Status
              </Typography>
              <Box sx={{ width: 28 }} />
            </Box>
            {paginated.map((item) => (
              <CompactRow key={item.id} item={item} onClick={() => handleItemClick(item)} onChat={handleChat} />
            ))}
          </Box>
        )}

        {/* ── Pagination ──────────────────────────────────────── */}
        {!isLoading && totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <Pagination
              count={totalPages}
              page={safePage}
              onChange={(_, v) => setPage(v)}
              sx={{
                '& .MuiPaginationItem-root': {
                  color: 'text.secondary',
                  borderColor: borderSubtle,
                  '&.Mui-selected': {
                    backgroundColor: glowMedium,
                    color: '#00E5FF',
                    borderColor: borderHover,
                  },
                },
              }}
            />
          </Box>
        )}

      </Container>

      {/* ── Chat Drawer ─────────────────────────────────────── */}
      {chatClaimId && (
        <ClaimChat
          claimId={chatClaimId}
          open={!!chatClaimId}
          onClose={() => setChatClaimId(null)}
        />
      )}
    </Box>
  );
};
