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
import { api } from '../../src/services/api';
import { MEDIA_URL } from '../../src/services/config';

export default function PartDetailScreen() {
  const { partId } = useLocalSearchParams<{ partId: string }>();
  const { data: part, isLoading, error } = api.useGetPartDetailQuery(partId!);
  const [orderFromPart, { isLoading: ordering }] = api.useOrderFromPartMutation();
  const [quantity, setQuantity] = useState(1);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.cyan} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !part) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <FontAwesome name="exclamation-triangle" size={48} color={colors.error} />
          <Text style={styles.errorText}>Part not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back to Catalog</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const thumbnailUrl = part.task_id ? `${MEDIA_URL}/thumbnail/${part.task_id}` : null;

  const handleOrder = async () => {
    try {
      await orderFromPart({ part_id: part.id, quantity }).unwrap();
      Alert.alert('Added to Basket', `${part.name} x${quantity} added to your basket.`, [
        { text: 'Keep Browsing', onPress: () => router.back() },
        { text: 'View Basket', onPress: () => router.push('/(tabs)/profile') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.data?.detail || 'Failed to add to basket');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Thumbnail / Viewer */}
        <View style={styles.viewerContainer}>
          {thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={styles.viewerImage}
              contentFit="contain"
              transition={200}
            />
          ) : (
            <View style={styles.viewerPlaceholder}>
              <FontAwesome name="cube" size={64} color={colors.textDisabled} />
              <Text style={styles.viewerText}>No Preview</Text>
            </View>
          )}
        </View>

        {/* Title + Chips */}
        <View style={styles.card}>
          <Text style={styles.partTitle}>{part.name}</Text>
          {part.description && (
            <Text style={styles.partDescription}>{part.description}</Text>
          )}

          <View style={styles.chipRow}>
            <View style={[styles.chip, styles.chipPrimary]}>
              <Text style={styles.chipTextPrimary}>{part.file_type.toUpperCase()}</Text>
            </View>
            {part.recommended_process && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{part.recommended_process}</Text>
              </View>
            )}
            {part.recommended_material && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{part.recommended_material}</Text>
              </View>
            )}
            {part.category && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{part.category}</Text>
              </View>
            )}
          </View>

          {part.tags && part.tags.length > 0 && (
            <View style={[styles.chipRow, { marginTop: spacing.sm }]}>
              {part.tags.map((tag: string) => (
                <View key={tag} style={styles.chipTag}>
                  <Text style={styles.chipText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.statsRow}>
            <FontAwesome name="download" size={14} color={colors.textSecondary} />
            <Text style={styles.statsText}>{part.download_count} orders</Text>
          </View>
        </View>

        {/* Specifications */}
        {(part.volume_cm3 || part.bounding_box_x) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Specifications</Text>
            {part.bounding_box_x && part.bounding_box_y && part.bounding_box_z && (
              <MetaRow
                label="Bounding Box"
                value={`${part.bounding_box_x.toFixed(1)} × ${part.bounding_box_y.toFixed(1)} × ${part.bounding_box_z.toFixed(1)} mm`}
              />
            )}
            {part.volume_cm3 && (
              <MetaRow label="Volume" value={`${part.volume_cm3.toFixed(2)} cm³`} />
            )}
            {part.surface_area_cm2 && (
              <MetaRow label="Surface Area" value={`${part.surface_area_cm2.toFixed(2)} cm²`} />
            )}
          </View>
        )}

        {/* Quantity Selector */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Quantity</Text>
          <View style={styles.quantityRow}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            >
              <FontAwesome name="minus" size={14} color={colors.cyan} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => setQuantity((q) => q + 1)}
            >
              <FontAwesome name="plus" size={14} color={colors.cyan} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Order Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.orderButton, ordering && styles.orderButtonDisabled]}
          onPress={handleOrder}
          disabled={ordering}
        >
          {ordering ? (
            <ActivityIndicator size="small" color={colors.bgBase} />
          ) : (
            <Text style={styles.orderButtonText}>Add to Basket — ×{quantity}</Text>
          )}
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
  container: { flex: 1, backgroundColor: colors.bgBase },
  scrollContent: { padding: spacing.lg, paddingBottom: 100 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  errorText: { fontSize: fontSizes.sectionTitle, color: colors.error, fontWeight: '600' },
  backButton: { marginTop: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  backButtonText: { color: colors.cyan, fontSize: fontSizes.body },
  viewerContainer: {
    height: 300,
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  viewerImage: { width: '100%', height: '100%' },
  viewerPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  viewerText: { color: colors.textDisabled, fontSize: fontSizes.sectionTitle },
  card: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.cyanSubtle,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  partTitle: { fontSize: fontSizes.screenTitle, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs },
  partDescription: { fontSize: fontSizes.body, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.cyanSubtle,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  chipPrimary: { backgroundColor: 'rgba(0, 229, 255, 0.15)', borderColor: colors.cyan },
  chipTag: {
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  chipText: { fontSize: fontSizes.badge, color: colors.textSecondary },
  chipTextPrimary: { fontSize: fontSizes.badge, color: colors.cyan, fontWeight: '600' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  statsText: { fontSize: fontSizes.caption, color: colors.textSecondary },
  sectionTitle: { fontSize: fontSizes.sectionTitle, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cyanSubtle,
  },
  metaLabel: { color: colors.textSecondary, fontSize: fontSizes.body },
  metaValue: { color: colors.textPrimary, fontSize: fontSizes.body, fontWeight: '500', fontFamily: 'SpaceMono' },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cyanSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, fontFamily: 'SpaceMono', minWidth: 40, textAlign: 'center' },
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
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  orderButtonDisabled: { opacity: 0.6 },
  orderButtonText: { color: colors.bgBase, fontSize: fontSizes.body, fontWeight: '600' },
});
