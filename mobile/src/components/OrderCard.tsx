import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, fontSizes, borderRadius } from '../theme';
import { statusColors } from '../theme/colors';
import { MEDIA_URL } from '../services/config';

interface OrderCardProps {
  order: any; // Order from /user_claimable
  onClaim?: () => void;
  isClaiming?: boolean;
}

export function OrderCard({ order, onClaim, isClaiming }: OrderCardProps) {
  const thumbnailUrl = order.task_id
    ? `${MEDIA_URL}/thumbnail/${order.task_id}`
    : null;
  const remaining = order.quantity - order.quantity_claimed;

  return (
    <View style={styles.card}>
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
          <FontAwesome name="cube" size={32} color={colors.textDisabled} />
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>{order.name}</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detail}>{order.material}</Text>
          <Text style={styles.detailSep}>·</Text>
          <Text style={styles.detail}>{order.technique}</Text>
        </View>

        <View style={styles.chipRow}>
          {order.qa_level === 'high' && (
            <View style={[styles.chip, styles.chipWarning]}>
              <Text style={styles.chipTextWarning}>High QA</Text>
            </View>
          )}
          <View style={styles.chip}>
            <Text style={styles.chipText}>{order.selectedFileType?.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.bottomRow}>
          <Text style={styles.price}>£{order.price?.toFixed(2)}</Text>
          <Text style={styles.quantity}>
            {remaining} of {order.quantity} needed
          </Text>
        </View>
      </View>

      {/* Claim Button */}
      {onClaim && remaining > 0 && (
        <TouchableOpacity
          style={[styles.claimButton, isClaiming && styles.claimButtonDisabled]}
          onPress={onClaim}
          disabled={isClaiming}
        >
          <FontAwesome name="hand-paper-o" size={14} color={colors.bgBase} />
          <Text style={styles.claimButtonText}>Claim</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

interface ClaimCardProps {
  claim: any; // Claim from /user_claims
  onPress?: () => void;
}

export function ClaimCard({ claim, onPress }: ClaimCardProps) {
  const order = claim.order;
  const statusColor = statusColors[claim.status as keyof typeof statusColors] || colors.textSecondary;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.thumbnailContainer}>
        {order?.task_id ? (
          <Image
            source={{ uri: `${MEDIA_URL}/thumbnail/${order.task_id}` }}
            style={styles.thumbnail}
            contentFit="contain"
            transition={200}
          />
        ) : (
          <FontAwesome name="cube" size={32} color={colors.textDisabled} />
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>{order?.name || 'Order'}</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detail}>{order?.material}</Text>
          <Text style={styles.detailSep}>·</Text>
          <Text style={styles.detail}>×{claim.quantity}</Text>
        </View>

        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {claim.status.replace(/_/g, ' ')}
          </Text>
        </View>
      </View>

      <FontAwesome name="chevron-right" size={14} color={colors.textDisabled} style={styles.chevron} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.cyanSubtle,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  thumbnailContainer: {
    width: 90,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'center',
  },
  name: {
    fontSize: fontSizes.cardTitle,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  detail: {
    fontSize: fontSizes.caption,
    color: colors.textSecondary,
  },
  detailSep: {
    fontSize: fontSizes.caption,
    color: colors.textDisabled,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  chip: {
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  chipWarning: {
    backgroundColor: 'rgba(255, 145, 0, 0.15)',
  },
  chipText: {
    fontSize: fontSizes.badge,
    color: colors.textSecondary,
  },
  chipTextWarning: {
    fontSize: fontSizes.badge,
    color: colors.warning,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    fontSize: fontSizes.body,
    fontWeight: '700',
    color: colors.cyan,
    fontFamily: 'SpaceMono',
  },
  quantity: {
    fontSize: fontSizes.caption,
    color: colors.textSecondary,
  },
  claimButton: {
    backgroundColor: colors.cyan,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  claimButtonDisabled: {
    opacity: 0.5,
  },
  claimButtonText: {
    fontSize: fontSizes.badge,
    fontWeight: '600',
    color: colors.bgBase,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: fontSizes.caption,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  chevron: {
    alignSelf: 'center',
    paddingRight: spacing.md,
  },
});
