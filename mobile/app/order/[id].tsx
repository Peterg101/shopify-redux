import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, fontSizes, borderRadius } from '../../src/theme';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Order Header */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order {id}</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusChip}>
              <Text style={styles.statusText}>Pending</Text>
            </View>
          </View>
        </View>

        {/* 3D Preview Placeholder */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Model Preview</Text>
          <View style={styles.viewerPlaceholder}>
            <FontAwesome name="cube" size={48} color={colors.textDisabled} />
            <Text style={styles.placeholderText}>3D Viewer</Text>
          </View>
        </View>

        {/* Order Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Details</Text>
          <DetailRow label="Material" value="--" />
          <DetailRow label="Process" value="--" />
          <DetailRow label="Quantity" value="--" />
          <DetailRow label="Price" value="--" />
        </View>

        {/* Timeline Placeholder */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <Text style={styles.placeholderText}>
            Order timeline will appear here
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.cyanSubtle,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSizes.sectionTitle,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
  },
  statusChip: {
    backgroundColor: colors.cyanSubtle,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    fontWeight: '500',
  },
  viewerPlaceholder: {
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.md,
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
    gap: spacing.sm,
  },
  placeholderText: {
    color: colors.textDisabled,
    fontSize: fontSizes.body,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cyanSubtle,
  },
  detailLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
  },
  detailValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: '500',
  },
});
