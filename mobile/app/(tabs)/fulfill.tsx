import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, fontSizes, borderRadius } from '../../src/theme';
import { api } from '../../src/services/api';
import { OrderCard, ClaimCard } from '../../src/components/OrderCard';

type Segment = 'marketplace' | 'claims';

export default function FulfillScreen() {
  const [segment, setSegment] = useState<Segment>('marketplace');

  const {
    data: claimableOrders,
    isLoading: loadingMarketplace,
    isFetching: fetchingMarketplace,
    refetch: refetchMarketplace,
  } = api.useGetUserClaimableQuery(undefined);

  const {
    data: myClaims,
    isLoading: loadingClaims,
    isFetching: fetchingClaims,
    refetch: refetchClaims,
  } = api.useGetUserClaimsQuery(undefined);

  const [claimOrder, { isLoading: claiming }] = api.useClaimOrderMutation();
  const [claimingOrderId, setClaimingOrderId] = useState<string | null>(null);

  const handleClaim = useCallback(async (orderId: string) => {
    setClaimingOrderId(orderId);
    try {
      await claimOrder({ order_id: orderId, quantity: 1 }).unwrap();
      Alert.alert('Claimed!', 'Order claimed successfully. Check "My Claims" to manage it.');
    } catch (err: any) {
      Alert.alert('Error', err.data?.detail || 'Failed to claim order');
    } finally {
      setClaimingOrderId(null);
    }
  }, [claimOrder]);

  const isLoading = segment === 'marketplace' ? loadingMarketplace : loadingClaims;
  const isFetching = segment === 'marketplace' ? fetchingMarketplace : fetchingClaims;
  const refetch = segment === 'marketplace' ? refetchMarketplace : refetchClaims;

  const renderMarketplaceItem = useCallback(({ item }: { item: any }) => (
    <OrderCard
      order={item}
      onClaim={() => handleClaim(item.order_id)}
      isClaiming={claiming && claimingOrderId === item.order_id}
    />
  ), [handleClaim, claiming, claimingOrderId]);

  const renderClaimItem = useCallback(({ item }: { item: any }) => (
    <ClaimCard
      claim={item}
      onPress={() => router.push(`/claim/${item.id}`)}
    />
  ), []);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    if (segment === 'marketplace') {
      return (
        <View style={styles.emptyContainer}>
          <FontAwesome name="inbox" size={48} color={colors.textDisabled} />
          <Text style={styles.emptyTitle}>No orders available</Text>
          <Text style={styles.emptySubtext}>New manufacturing orders will appear here</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <FontAwesome name="tasks" size={48} color={colors.textDisabled} />
        <Text style={styles.emptyTitle}>No claimed orders</Text>
        <Text style={styles.emptySubtext}>Orders you claim will appear here for tracking</Text>
      </View>
    );
  }, [isLoading, segment]);

  const data = segment === 'marketplace' ? (claimableOrders ?? []) : (myClaims ?? []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Fulfill</Text>

      {/* Segment Toggle */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentButton, segment === 'marketplace' && styles.segmentActive]}
          onPress={() => setSegment('marketplace')}
        >
          <Text style={[styles.segmentText, segment === 'marketplace' && styles.segmentTextActive]}>
            Marketplace
          </Text>
          {claimableOrders && claimableOrders.length > 0 && segment !== 'marketplace' && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{claimableOrders.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentButton, segment === 'claims' && styles.segmentActive]}
          onPress={() => setSegment('claims')}
        >
          <Text style={[styles.segmentText, segment === 'claims' && styles.segmentTextActive]}>
            My Claims
          </Text>
          {myClaims && myClaims.length > 0 && segment !== 'claims' && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{myClaims.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.cyan} />
        </View>
      ) : (
        <FlashList
          data={data}
          renderItem={segment === 'marketplace' ? renderMarketplaceItem : renderClaimItem}
          keyExtractor={(item: any) => segment === 'marketplace' ? item.order_id : item.id}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
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
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  segmentActive: { backgroundColor: colors.cyan },
  segmentText: { color: colors.textSecondary, fontSize: fontSizes.body, fontWeight: '500' },
  segmentTextActive: { color: colors.bgBase },
  badge: {
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
    gap: spacing.sm,
  },
  emptyTitle: { fontSize: fontSizes.sectionTitle, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.md },
  emptySubtext: { fontSize: fontSizes.caption, color: colors.textDisabled, textAlign: 'center' },
});
