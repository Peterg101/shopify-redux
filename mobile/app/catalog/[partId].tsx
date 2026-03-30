import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, fontSizes, borderRadius } from '../../src/theme';

export default function PartDetailScreen() {
  const { partId } = useLocalSearchParams<{ partId: string }>();

  const handleOrder = () => {
    console.log('Order part:', partId);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 3D Viewer Placeholder */}
        <View style={styles.viewerPlaceholder}>
          <FontAwesome name="cube" size={64} color={colors.textDisabled} />
          <Text style={styles.viewerText}>3D Viewer</Text>
        </View>

        {/* Part Metadata */}
        <View style={styles.card}>
          <Text style={styles.partTitle}>Part {partId}</Text>
          <Text style={styles.partDescription}>
            Part details and metadata will be loaded here.
          </Text>
        </View>

        {/* Specifications */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Specifications</Text>
          <MetaRow label="Format" value="--" />
          <MetaRow label="Volume" value="--" />
          <MetaRow label="Bounding Box" value="--" />
          <MetaRow label="Surface Area" value="--" />
        </View>

        {/* Creator Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Shared By</Text>
          <Text style={styles.placeholderText}>Creator information</Text>
        </View>
      </ScrollView>

      {/* Order Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.orderButton} onPress={handleOrder}>
          <Text style={styles.orderButtonText}>Order This Part</Text>
        </TouchableOpacity>
      </View>
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
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  viewerPlaceholder: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.cyanSubtle,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 250,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  viewerText: {
    color: colors.textDisabled,
    fontSize: fontSizes.sectionTitle,
  },
  card: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.cyanSubtle,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  partTitle: {
    fontSize: fontSizes.screenTitle,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  partDescription: {
    fontSize: fontSizes.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: fontSizes.sectionTitle,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cyanSubtle,
  },
  metaLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
  },
  metaValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: '500',
  },
  placeholderText: {
    color: colors.textDisabled,
    fontSize: fontSizes.body,
  },
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
  },
  orderButton: {
    backgroundColor: colors.cyan,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  orderButtonText: {
    color: colors.bgBase,
    fontSize: fontSizes.body,
    fontWeight: '600',
  },
});
