import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, fontSizes, borderRadius } from '../../src/theme';

type Segment = 'marketplace' | 'claims';

export default function FulfillScreen() {
  const [segment, setSegment] = useState<Segment>('marketplace');

  const renderEmptyMarketplace = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <FontAwesome name="inbox" size={48} color={colors.textDisabled} />
        <Text style={styles.emptyTitle}>No orders available</Text>
        <Text style={styles.emptySubtext}>
          New manufacturing orders will appear here
        </Text>
      </View>
    ),
    []
  );

  const renderEmptyClaims = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <FontAwesome name="tasks" size={48} color={colors.textDisabled} />
        <Text style={styles.emptyTitle}>No claimed orders</Text>
        <Text style={styles.emptySubtext}>
          Orders you claim will appear here for tracking
        </Text>
      </View>
    ),
    []
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Fulfill</Text>

      {/* Segment Toggle */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentButton, segment === 'marketplace' && styles.segmentActive]}
          onPress={() => setSegment('marketplace')}
        >
          <Text
            style={[
              styles.segmentText,
              segment === 'marketplace' && styles.segmentTextActive,
            ]}
          >
            Marketplace
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentButton, segment === 'claims' && styles.segmentActive]}
          onPress={() => setSegment('claims')}
        >
          <Text
            style={[
              styles.segmentText,
              segment === 'claims' && styles.segmentTextActive,
            ]}
          >
            My Claims
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <View style={styles.listContainer}>
        <FlashList
          data={[]}
          renderItem={() => null}
          ListEmptyComponent={
            segment === 'marketplace' ? renderEmptyMarketplace : renderEmptyClaims
          }
        />
      </View>
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
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  segmentActive: {
    backgroundColor: colors.cyan,
  },
  segmentText: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: colors.bgBase,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
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
