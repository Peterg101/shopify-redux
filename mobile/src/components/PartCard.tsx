import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, borderRadius } from '../theme';
import { MEDIA_URL } from '../services/config';
import type { Part } from '../types';

interface PartCardProps {
  part: Part;
}

export function PartCard({ part }: PartCardProps) {
  const thumbnailUrl = part.task_id
    ? `${MEDIA_URL}/thumbnail/${part.task_id}`
    : null;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/catalog/${part.id}`)}
    >
      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {thumbnailUrl ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.thumbnail}
            contentFit="contain"
            transition={200}
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          />
        ) : (
          <FontAwesome name="cube" size={36} color={colors.textDisabled} />
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>{part.name}</Text>

        {part.description && (
          <Text style={styles.description} numberOfLines={2}>
            {part.description}
          </Text>
        )}

        {/* Chips */}
        <View style={styles.chipRow}>
          <View style={[styles.chip, styles.chipPrimary]}>
            <Text style={styles.chipTextPrimary}>{part.file_type.toUpperCase()}</Text>
          </View>
          {part.recommended_process && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{part.recommended_process}</Text>
            </View>
          )}
          {part.category && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{part.category}</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.downloadCount}>
            <FontAwesome name="download" size={12} color={colors.textDisabled} />
            <Text style={styles.downloadText}>{part.download_count}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.cyanSubtle,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  thumbnailContainer: {
    height: 140,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  content: {
    padding: spacing.lg,
  },
  name: {
    fontSize: fontSizes.cardTitle,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: fontSizes.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  chip: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.cyanSubtle,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  chipPrimary: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: colors.cyan,
  },
  chipText: {
    fontSize: fontSizes.badge,
    color: colors.textSecondary,
  },
  chipTextPrimary: {
    fontSize: fontSizes.badge,
    color: colors.cyan,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  downloadCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  downloadText: {
    fontSize: fontSizes.caption,
    color: colors.textDisabled,
  },
});
