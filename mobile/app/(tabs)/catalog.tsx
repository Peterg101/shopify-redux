import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, fontSizes, borderRadius } from '../../src/theme';

export default function CatalogScreen() {
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Placeholder — will trigger RTK Query refetch
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Catalog</Text>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <FontAwesome
          name="search"
          size={16}
          color={colors.textDisabled}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search parts..."
          placeholderTextColor={colors.textDisabled}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.cyan}
            colors={[colors.cyan]}
          />
        }
      >
        {/* Placeholder Grid */}
        <View style={styles.emptyContainer}>
          <FontAwesome name="th-large" size={48} color={colors.textDisabled} />
          <Text style={styles.emptyTitle}>Browse the parts catalog</Text>
          <Text style={styles.emptySubtext}>
            Community-shared 3D models and engineering parts
          </Text>
        </View>
      </ScrollView>
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
    marginBottom: spacing.lg,
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
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
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
});
