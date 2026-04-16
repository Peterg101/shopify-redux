import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, fontSizes, borderRadius } from '../../theme';

interface SpecCardProps {
  spec: Record<string, any>;
  onApprove: (spec: Record<string, any>) => void;
  onEdit: () => void;
}

export function SpecCard({ spec, onApprove, onEdit }: SpecCardProps) {
  const [editableSpec, setEditableSpec] = useState(spec);
  const [isEditing, setIsEditing] = useState(false);

  const dims = editableSpec.dimensions;
  const features = editableSpec.features || [];

  const updateDimension = (key: string, value: string) => {
    const num = parseFloat(value);
    setEditableSpec((prev: Record<string, any>) => ({
      ...prev,
      dimensions: { ...prev.dimensions, [key]: isNaN(num) ? value : num },
    }));
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <FontAwesome name="check-circle" size={16} color={colors.cyan} />
        <Text style={styles.headerTitle}>Design Specification</Text>
        <View style={{ flex: 1 }} />
        {!isEditing && (
          <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editButton}>
            <FontAwesome name="pencil" size={12} color={colors.cyan} />
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.description}>{editableSpec.description}</Text>
        {editableSpec.purpose && (
          <Text style={styles.purpose}>{editableSpec.purpose}</Text>
        )}

        {/* Dimensions */}
        {dims && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Dimensions ({dims.units || 'mm'})</Text>
            <View style={styles.dimsRow}>
              {(['length', 'width', 'height'] as const).map((key) =>
                isEditing ? (
                  <TextInput
                    key={key}
                    style={styles.dimInput}
                    keyboardType="numeric"
                    placeholder={key}
                    placeholderTextColor={colors.textDisabled}
                    value={dims[key]?.toString() ?? ''}
                    onChangeText={(val) => updateDimension(key, val)}
                  />
                ) : (
                  <View key={key} style={styles.dimChip}>
                    <Text style={styles.dimChipText}>{key}: {dims[key] ?? '?'}</Text>
                  </View>
                ),
              )}
            </View>
          </View>
        )}

        {/* Wall thickness */}
        {editableSpec.wall_thickness != null && (
          <Text style={styles.detail}>Wall: {editableSpec.wall_thickness}mm</Text>
        )}

        {/* Features */}
        {features.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Features</Text>
            {features.map((f: any, i: number) => (
              <Text key={i} style={styles.featureItem}>
                {f.description || f.type}
                {f.count ? ` x${f.count}` : ''}
                {f.diameter ? ` (${f.diameter}mm)` : ''}
                {f.position ? ` - ${f.position}` : ''}
              </Text>
            ))}
          </View>
        )}

        {/* Process + Material chips */}
        <View style={styles.chipRow}>
          {editableSpec.process && (
            <View style={styles.processChip}>
              <Text style={styles.processChipText}>{editableSpec.process.toUpperCase()}</Text>
            </View>
          )}
          {editableSpec.material && (
            <View style={styles.outlineChip}>
              <Text style={styles.outlineChipText}>{editableSpec.material}</Text>
            </View>
          )}
          {editableSpec.tolerances && (
            <View style={styles.outlineChip}>
              <Text style={styles.outlineChipText}>{editableSpec.tolerances}</Text>
            </View>
          )}
        </View>

        {editableSpec.notes && (
          <Text style={styles.detail}>{editableSpec.notes}</Text>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.editActionButton}
            onPress={() => { setIsEditing(false); onEdit(); }}
          >
            <Text style={styles.editActionText}>Continue Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.approveButton}
            onPress={() => onApprove(editableSpec)}
          >
            <FontAwesome name="cogs" size={14} color={colors.bgBase} style={{ marginRight: spacing.xs }} />
            <Text style={styles.approveText}>Approve & Generate</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: colors.cyan,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.bgSurface,
    overflow: 'hidden',
    shadowColor: colors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cyanSubtle,
    backgroundColor: colors.bgElevated,
  },
  headerTitle: {
    fontSize: fontSizes.caption,
    fontWeight: '600',
    color: colors.cyan,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editText: {
    fontSize: fontSizes.badge,
    color: colors.cyan,
  },
  body: {
    padding: spacing.md,
  },
  description: {
    fontSize: fontSizes.body,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  purpose: {
    fontSize: fontSizes.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: fontSizes.badge,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  dimsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dimInput: {
    flex: 1,
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.cyanSubtle,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    color: colors.textPrimary,
    fontSize: fontSizes.caption,
    textAlign: 'center',
  },
  dimChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.cyanSubtle,
  },
  dimChipText: {
    fontSize: fontSizes.badge,
    color: colors.textPrimary,
  },
  detail: {
    fontSize: fontSizes.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  featureItem: {
    fontSize: fontSizes.caption,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    lineHeight: 22,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  processChip: {
    backgroundColor: colors.cyanSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  processChipText: {
    fontSize: fontSizes.badge,
    color: colors.cyan,
    fontWeight: '600',
  },
  outlineChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.cyanSubtle,
  },
  outlineChipText: {
    fontSize: fontSizes.badge,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.cyanSubtle,
    marginVertical: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  editActionButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.cyanSubtle,
  },
  editActionText: {
    fontSize: fontSizes.caption,
    color: colors.textPrimary,
  },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.cyan,
  },
  approveText: {
    fontSize: fontSizes.caption,
    fontWeight: '600',
    color: colors.bgBase,
  },
});
