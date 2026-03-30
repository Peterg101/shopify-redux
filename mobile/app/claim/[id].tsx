import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Image } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, fontSizes, borderRadius } from '../../src/theme';
import { statusColors } from '../../src/theme/colors';
import { api } from '../../src/services/api';
import { MEDIA_URL } from '../../src/services/config';

const STATUS_FLOW = ['pending', 'in_progress', 'printing', 'qa_check', 'shipped', 'delivered'];

const NEXT_STATUS: Record<string, string> = {
  pending: 'in_progress',
  in_progress: 'printing',
  printing: 'qa_check',
  qa_check: 'shipped',
  shipped: 'delivered',
};

export default function ClaimDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: claims, isLoading } = api.useGetUserClaimsQuery(undefined);
  const { data: evidence } = api.useGetClaimEvidenceQuery(id!);
  const { data: history } = api.useGetClaimHistoryQuery(id!);
  const [updateStatus, { isLoading: updating }] = api.useUpdateClaimStatusMutation();

  const claim = claims?.find((c: any) => c.id === id);
  const order = claim?.order;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.cyan} />
        </View>
      </SafeAreaView>
    );
  }

  if (!claim) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <FontAwesome name="exclamation-triangle" size={48} color={colors.error} />
          <Text style={styles.errorText}>Claim not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.linkText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentIndex = STATUS_FLOW.indexOf(claim.status);
  const nextStatus = NEXT_STATUS[claim.status];
  const isTerminal = ['delivered', 'accepted', 'disputed', 'cancelled'].includes(claim.status);

  const handleAdvance = () => {
    if (!nextStatus) return;
    Alert.alert(
      'Update Status',
      `Advance to "${nextStatus.replace(/_/g, ' ')}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await updateStatus({ claimId: id!, status: nextStatus }).unwrap();
            } catch (err: any) {
              Alert.alert('Error', err.data?.detail || 'Failed to update status');
            }
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Claim',
      'Are you sure? This will return the items to the marketplace.',
      [
        { text: 'Keep Claim', style: 'cancel' },
        {
          text: 'Cancel Claim',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateStatus({ claimId: id!, status: 'cancelled' }).unwrap();
              router.back();
            } catch (err: any) {
              Alert.alert('Error', err.data?.detail || 'Failed to cancel');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Stepper */}
        <View style={styles.stepperContainer}>
          {STATUS_FLOW.map((status, i) => {
            const isCompleted = i < currentIndex;
            const isCurrent = i === currentIndex;
            const color = isCurrent
              ? statusColors[status as keyof typeof statusColors] || colors.cyan
              : isCompleted
              ? colors.success
              : colors.textDisabled;

            return (
              <View key={status} style={styles.stepItem}>
                <View style={[styles.stepDot, { backgroundColor: color, borderColor: color }]}>
                  {isCompleted && <FontAwesome name="check" size={8} color={colors.bgBase} />}
                </View>
                <Text style={[styles.stepLabel, { color }]}>
                  {status.replace(/_/g, '\n')}
                </Text>
                {i < STATUS_FLOW.length - 1 && (
                  <View style={[styles.stepLine, { backgroundColor: isCompleted ? colors.success : colors.textDisabled }]} />
                )}
              </View>
            );
          })}
        </View>

        {/* Thumbnail */}
        {order?.task_id && (
          <View style={styles.thumbnailContainer}>
            <Image
              source={{ uri: `${MEDIA_URL}/thumbnail/${order.task_id}` }}
              style={styles.thumbnail}
              contentFit="contain"
              transition={200}
            />
          </View>
        )}

        {/* Order Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order Details</Text>
          <MetaRow label="Name" value={order?.name || '--'} />
          <MetaRow label="Material" value={order?.material || '--'} />
          <MetaRow label="Technique" value={order?.technique || '--'} />
          <MetaRow label="Quantity" value={`${claim.quantity}`} />
          <MetaRow label="Price" value={`£${order?.price?.toFixed(2) || '--'}`} mono />
          {order?.qa_level && <MetaRow label="QA Level" value={order.qa_level} />}
        </View>

        {/* Evidence */}
        {evidence && evidence.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Evidence ({evidence.length})</Text>
            {evidence.map((e: any) => (
              <View key={e.id} style={styles.evidenceItem}>
                <FontAwesome name="image" size={14} color={colors.textSecondary} />
                <Text style={styles.evidenceText} numberOfLines={1}>
                  {e.description || 'Evidence photo'}
                </Text>
                <Text style={styles.evidenceDate}>
                  {new Date(e.uploaded_at).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* History */}
        {history && history.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Status History</Text>
            {history.map((h: any) => (
              <View key={h.id} style={styles.historyItem}>
                <View style={[styles.historyDot, {
                  backgroundColor: statusColors[h.new_status as keyof typeof statusColors] || colors.textSecondary
                }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyStatus}>
                    {h.previous_status?.replace(/_/g, ' ')} → {h.new_status.replace(/_/g, ' ')}
                  </Text>
                  <Text style={styles.historyDate}>
                    {new Date(h.changed_at).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Bar */}
      {!isTerminal && (
        <View style={styles.bottomBar}>
          {['pending', 'in_progress'].includes(claim.status) && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}
          {nextStatus && (
            <TouchableOpacity
              style={[styles.advanceButton, updating && { opacity: 0.5 }]}
              onPress={handleAdvance}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator size="small" color={colors.bgBase} />
              ) : (
                <Text style={styles.advanceButtonText}>
                  Advance to {nextStatus.replace(/_/g, ' ')}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, mono && { fontFamily: 'SpaceMono', color: colors.cyan }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  errorText: { fontSize: fontSizes.sectionTitle, color: colors.error, fontWeight: '600' },
  linkText: { color: colors.cyan, fontSize: fontSizes.body },
  scrollContent: { padding: spacing.lg, paddingBottom: 120 },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
  stepItem: { alignItems: 'center', flex: 1, position: 'relative' },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  stepLabel: { fontSize: 9, textAlign: 'center', textTransform: 'capitalize' },
  stepLine: {
    position: 'absolute',
    top: 10,
    left: '60%',
    right: '-40%',
    height: 2,
    zIndex: -1,
  },
  thumbnailContainer: {
    height: 200,
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  thumbnail: { width: '100%', height: '100%' },
  card: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.cyanSubtle,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: { fontSize: fontSizes.sectionTitle, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cyanSubtle,
  },
  metaLabel: { color: colors.textSecondary, fontSize: fontSizes.body },
  metaValue: { color: colors.textPrimary, fontSize: fontSizes.body, fontWeight: '500' },
  evidenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cyanSubtle,
  },
  evidenceText: { flex: 1, color: colors.textPrimary, fontSize: fontSizes.body },
  evidenceDate: { color: colors.textDisabled, fontSize: fontSizes.caption },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  historyDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  historyStatus: { color: colors.textPrimary, fontSize: fontSizes.body, textTransform: 'capitalize' },
  historyDate: { color: colors.textDisabled, fontSize: fontSizes.caption },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bgSurface,
    borderTopColor: colors.cyanSubtle,
    borderTopWidth: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  cancelButtonText: { color: colors.error, fontSize: fontSizes.body, fontWeight: '600' },
  advanceButton: {
    flex: 1,
    backgroundColor: colors.cyan,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  advanceButtonText: { color: colors.bgBase, fontSize: fontSizes.body, fontWeight: '600', textTransform: 'capitalize' },
});
