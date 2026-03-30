import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, fontSizes, borderRadius } from '../../src/theme';
import { api } from '../../src/services/api';
import { PartCard } from '../../src/components/PartCard';
import type { Part } from '../../src/types';

const FILE_TYPE_FILTERS = ['All', 'STL', 'OBJ', 'STEP'];

export default function CatalogScreen() {
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('All');
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, refetch } = api.useGetPartsQuery({
    page,
    search: activeSearch || undefined,
    file_type: fileTypeFilter !== 'All' ? fileTypeFilter.toLowerCase() : undefined,
  });

  const parts: Part[] = data?.parts ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const handleSearch = useCallback(() => {
    setActiveSearch(search);
    setPage(1);
  }, [search]);

  const renderItem = useCallback(({ item }: { item: Part }) => (
    <PartCard part={item} />
  ), []);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <FontAwesome name="th-large" size={48} color={colors.textDisabled} />
        <Text style={styles.emptyTitle}>
          {activeSearch ? 'No parts match your search' : 'No parts published yet'}
        </Text>
        <Text style={styles.emptySubtext}>
          {activeSearch ? 'Try different search terms' : 'Be the first to share a 3D model'}
        </Text>
      </View>
    );
  }, [isLoading, activeSearch]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Catalog</Text>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <FontAwesome name="search" size={16} color={colors.textDisabled} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search parts..."
          placeholderTextColor={colors.textDisabled}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(''); setActiveSearch(''); setPage(1); }}>
            <FontAwesome name="times" size={16} color={colors.textDisabled} />
          </TouchableOpacity>
        )}
      </View>

      {/* File Type Filters */}
      <View style={styles.filterRow}>
        {FILE_TYPE_FILTERS.map((ft) => (
          <TouchableOpacity
            key={ft}
            style={[styles.filterChip, fileTypeFilter === ft && styles.filterChipActive]}
            onPress={() => { setFileTypeFilter(ft); setPage(1); }}
          >
            <Text style={[styles.filterChipText, fileTypeFilter === ft && styles.filterChipTextActive]}>
              {ft}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Loading */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.cyan} />
        </View>
      ) : (
        <FlashList
          data={parts}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={colors.cyan}
              colors={[colors.cyan]}
            />
          }
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <View style={styles.pagination}>
          <TouchableOpacity
            style={[styles.pageButton, page <= 1 && styles.pageButtonDisabled]}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <FontAwesome name="chevron-left" size={14} color={page <= 1 ? colors.textDisabled : colors.cyan} />
          </TouchableOpacity>
          <Text style={styles.pageText}>{page} / {totalPages}</Text>
          <TouchableOpacity
            style={[styles.pageButton, page >= totalPages && styles.pageButtonDisabled]}
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            <FontAwesome name="chevron-right" size={14} color={page >= totalPages ? colors.textDisabled : colors.cyan} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  title: {
    fontSize: fontSizes.screenTitle,
    fontWeight: '700',
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    marginBottom: spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderColor: colors.cyanSubtle,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    paddingVertical: spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.cyanSubtle,
    backgroundColor: colors.bgSurface,
  },
  filterChipActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: colors.cyan,
  },
  filterChipText: {
    fontSize: fontSizes.caption,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.cyan,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSizes.sectionTitle,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: fontSizes.caption,
    color: colors.textDisabled,
    textAlign: 'center',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.cyanSubtle,
    backgroundColor: colors.bgSurface,
  },
  pageButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cyanSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageText: {
    fontSize: fontSizes.body,
    color: colors.textSecondary,
  },
});
