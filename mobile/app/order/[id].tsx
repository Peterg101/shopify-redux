import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Image } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, fontSizes, borderRadius } from '../../src/theme';
import { statusColors } from '../../src/theme/colors';
import { api } from '../../src/services/api';
import { MEDIA_URL } from '../../src/services/config';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isLoading, error } = api.useGetOrderDetailQuery(id!);
  const [toggleVisibility] = api.useToggleOrderVisibilityMutation();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.cyan} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <FontAwesome name="exclamation-triangle" size={48} color={colors.error} />
          <Text style={styles.errorText}>Order not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.linkText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const thumbnailUrl = order.task_id ? `${MEDIA_URL}/thumbnail/${order.task_id}` : null;
  const statusColor = statusColors[order.status as keyof typeof statusColors] || colors.textSecondary;
  const fulfilled = order.quantity_claimed >= order.quantity;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Thumbnail */}
        <View style={styles.thumbnailContainer}>
          {thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={styles.thumbnail}
              contentFit="contain"
              transition={200}
            />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <FontAwesome name="cube" size={64} color={colors.textDisabled} />
            </View>
          )}
        </View>

        {/* Header */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.orderName}>{order.name}</Text>
            <View style={[styles.statusChip, { borderColor: statusColor }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{order.status}</Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.price}>£{order.price?.toFixed(2)}</Text>
            <Text style={styles.quantity}>×{order.quantity}</Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order Details</Text>
          <MetaRow label="Material" value={order.material} />
          <MetaRow label="Technique" value={order.technique} />
          <MetaRow label="File Type" value={order.selectedFileType?.toUpperCase()} />
          <MetaRow label="Sizing" value={`×${order.sizing}`} />
          {order.colour && <MetaRow label="Colour" value={order.colour} />}
          {order.qa_level && <MetaRow label="QA Level" value={order.qa_level} />}
          {order.tolerance_mm && <MetaRow label="Tolerance" value={`${order.tolerance_mm}mm`} />}
          {order.surface_finish && <MetaRow label="Surface Finish" value={order.surface_finish} />}
        </View>

        {/* Fulfillment Progress */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Fulfillment</Text>
          <View style={styles.progressRow}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${(order.quantity_claimed / order.quantity) * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>{order.quantity_claimed}/{order.quantity} claimed</Text>
          </View>

          {/* Visibility Toggle */}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Visible on marketplace</Text>
            <Switch
              value={order.is_collaborative}
              onValueChange={(val) => { toggleVisibility({ orderId: id!, is_collaborative: val }); }}
              trackColor={{ false: colors.bgElevated, true: 'rgba(0, 229, 255, 0.3)' }}
              thumbColor={order.is_collaborative ? colors.cyan : colors.textDisabled}
            />
          </View>
        </View>

        {/* Claims */}
        {order.claims && order.claims.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Claims ({order.claims.length})</Text>
            {order.claims.map((claim: any) => {
              const claimColor = statusColors[claim.status as keyof typeof statusColors] || colors.textSecondary;
              return (
                <View key={claim.id} style={styles.claimItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.claimUser}>{claim.claimant_username || 'Fulfiller'}</Text>
                    <Text style={styles.claimDetail}>×{claim.quantity}</Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push(`/messages/${claim.id}`)} style={{ padding: spacing.xs }}>
                    <FontAwesome name="comment-o" size={18} color={colors.cyan} />
                  </TouchableOpacity>
                  <View style={[styles.claimStatusChip, { borderColor: claimColor }]}>
                    <View style={[styles.claimStatusDot, { backgroundColor: claimColor }]} />
                    <Text style={[styles.claimStatusText, { color: claimColor }]}>
                      {claim.status.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Shipping */}
        {order.shipping_name && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Shipping Address</Text>
            <Text style={styles.addressText}>{order.shipping_name}</Text>
            <Text style={styles.addressText}>{order.shipping_line1}</Text>
            {order.shipping_line2 && <Text style={styles.addressText}>{order.shipping_line2}</Text>}
            <Text style={styles.addressText}>{order.shipping_city}, {order.shipping_postal_code}</Text>
            <Text style={styles.addressText}>{order.shipping_country}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  errorText: { fontSize: fontSizes.sectionTitle, color: colors.error, fontWeight: '600' },
  linkText: { color: colors.cyan, fontSize: fontSizes.body },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  thumbnailContainer: {
    height: 250, backgroundColor: colors.bgElevated, borderRadius: borderRadius.xl,
    overflow: 'hidden', marginBottom: spacing.lg,
  },
  thumbnail: { width: '100%', height: '100%' },
  thumbnailPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.bgSurface, borderColor: colors.cyanSubtle, borderWidth: 1,
    borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  orderName: { fontSize: fontSizes.screenTitle, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: fontSizes.badge, fontWeight: '600', textTransform: 'capitalize' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  price: { fontSize: 28, fontWeight: '700', color: colors.cyan, fontFamily: 'SpaceMono' },
  quantity: { fontSize: fontSizes.body, color: colors.textSecondary },
  sectionTitle: { fontSize: fontSizes.sectionTitle, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.cyanSubtle,
  },
  metaLabel: { color: colors.textSecondary, fontSize: fontSizes.body },
  metaValue: { color: colors.textPrimary, fontSize: fontSizes.body, fontWeight: '500' },
  progressRow: { gap: spacing.sm, marginBottom: spacing.lg },
  progressBarBg: { height: 6, backgroundColor: colors.bgElevated, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: colors.cyan, borderRadius: 3 },
  progressText: { fontSize: fontSizes.caption, color: colors.textSecondary },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: fontSizes.body, color: colors.textPrimary },
  claimItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.cyanSubtle,
  },
  claimUser: { fontSize: fontSizes.body, fontWeight: '600', color: colors.textPrimary },
  claimDetail: { fontSize: fontSizes.caption, color: colors.textSecondary, marginTop: 2 },
  claimStatusChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  claimStatusDot: { width: 6, height: 6, borderRadius: 3 },
  claimStatusText: { fontSize: fontSizes.badge, fontWeight: '600', textTransform: 'capitalize' },
  addressText: { fontSize: fontSizes.body, color: colors.textSecondary, lineHeight: 22 },
});
