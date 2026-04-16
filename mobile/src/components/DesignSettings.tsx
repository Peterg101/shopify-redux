import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Switch,
  StyleSheet,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setCadGenerationSettings } from '../store/cadSlice';
import { colors, spacing, fontSizes, borderRadius } from '../theme';

const PROCESS_OPTIONS = [
  { value: 'fdm', label: 'FDM' },
  { value: 'sla', label: 'SLA' },
  { value: 'sls', label: 'SLS' },
  { value: 'cnc', label: 'CNC' },
  { value: 'injection', label: 'Injection' },
];

const MATERIAL_OPTIONS = [
  { value: 'plastic', label: 'Plastic' },
  { value: 'metal', label: 'Metal' },
  { value: 'rubber', label: 'Rubber' },
];

const FEATURE_OPTIONS = [
  { value: 'hollow', label: 'Hollow / Shelled' },
  { value: 'fillets', label: 'Add fillets' },
  { value: 'mounting_holes', label: 'Mounting holes' },
  { value: 'text_engraving', label: 'Text engraving' },
];

type SheetType = 'process' | 'material' | 'size' | 'advanced' | null;

export function DesignSettings() {
  const dispatch = useDispatch();
  const settings = useSelector((s: RootState) => s.cadState.cadGenerationSettings);
  const [activeSheet, setActiveSheet] = useState<SheetType>(null);

  const processLabel = PROCESS_OPTIONS.find((o) => o.value === settings.process)?.label ?? settings.process;
  const materialLabel = MATERIAL_OPTIONS.find((o) => o.value === settings.material_hint)?.label ?? settings.material_hint;
  const size = settings.approximate_size ?? { width: null, depth: null, height: null };
  const sizeSet = size.width != null || size.depth != null || size.height != null;
  const sizeLabel = sizeSet
    ? `${size.width ?? '—'}×${size.depth ?? '—'}×${size.height ?? '—'}`
    : 'Size';

  const updateSize = (dim: 'width' | 'depth' | 'height', val: string) => {
    const num = val === '' ? null : Number(val);
    const newSize = { ...size, [dim]: num };
    const allNull = newSize.width === null && newSize.depth === null && newSize.height === null;
    dispatch(setCadGenerationSettings({ settings: { approximate_size: allNull ? null : newSize } }));
  };

  const toggleFeature = (feature: string) => {
    const updated = settings.features.includes(feature)
      ? settings.features.filter((f) => f !== feature)
      : [...settings.features, feature];
    dispatch(setCadGenerationSettings({ settings: { features: updated } }));
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip label={processLabel} active onPress={() => setActiveSheet('process')} />
        <Chip label={materialLabel} active onPress={() => setActiveSheet('material')} />
        <Chip label={sizeLabel} active={sizeSet} onPress={() => setActiveSheet('size')} />
        <TouchableOpacity style={styles.gearButton} onPress={() => setActiveSheet('advanced')}>
          <FontAwesome name="sliders" size={14} color={colors.cyan} />
        </TouchableOpacity>
      </ScrollView>

      {/* Process sheet */}
      <BottomSheet visible={activeSheet === 'process'} onClose={() => setActiveSheet(null)} title="Process">
        {PROCESS_OPTIONS.map((opt) => (
          <OptionRow
            key={opt.value}
            label={opt.label}
            selected={settings.process === opt.value}
            onPress={() => {
              dispatch(setCadGenerationSettings({ settings: { process: opt.value } }));
              setActiveSheet(null);
            }}
          />
        ))}
      </BottomSheet>

      {/* Material sheet */}
      <BottomSheet visible={activeSheet === 'material'} onClose={() => setActiveSheet(null)} title="Material">
        {MATERIAL_OPTIONS.map((opt) => (
          <OptionRow
            key={opt.value}
            label={opt.label}
            selected={settings.material_hint === opt.value}
            onPress={() => {
              dispatch(setCadGenerationSettings({ settings: { material_hint: opt.value } }));
              setActiveSheet(null);
            }}
          />
        ))}
      </BottomSheet>

      {/* Size sheet */}
      <BottomSheet visible={activeSheet === 'size'} onClose={() => setActiveSheet(null)} title="Approximate Size (mm)">
        <View style={styles.sizeRow}>
          {(['width', 'depth', 'height'] as const).map((dim) => (
            <View key={dim} style={styles.sizeInput}>
              <Text style={styles.sizeLabel}>{dim[0].toUpperCase()}</Text>
              <TextInput
                style={styles.numericInput}
                keyboardType="numeric"
                placeholder="—"
                placeholderTextColor={colors.textDisabled}
                value={size[dim]?.toString() ?? ''}
                onChangeText={(val) => updateSize(dim, val)}
              />
            </View>
          ))}
        </View>
      </BottomSheet>

      {/* Advanced sheet */}
      <BottomSheet visible={activeSheet === 'advanced'} onClose={() => setActiveSheet(null)} title="Advanced Settings">
        <Text style={styles.sheetSectionTitle}>Features</Text>
        {FEATURE_OPTIONS.map((opt) => (
          <View key={opt.value} style={styles.switchRow}>
            <Text style={styles.switchLabel}>{opt.label}</Text>
            <Switch
              value={settings.features.includes(opt.value)}
              onValueChange={() => toggleFeature(opt.value)}
              trackColor={{ false: colors.bgElevated, true: colors.cyanSubtle }}
              thumbColor={settings.features.includes(opt.value) ? colors.cyan : colors.textDisabled}
            />
          </View>
        ))}
        <Text style={[styles.sheetSectionTitle, { marginTop: spacing.lg }]}>
          Max retries: {settings.max_iterations}
        </Text>
        <View style={styles.stepperRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <TouchableOpacity
              key={n}
              style={[styles.stepperButton, settings.max_iterations === n && styles.stepperActive]}
              onPress={() => dispatch(setCadGenerationSettings({ settings: { max_iterations: n } }))}
            >
              <Text style={[styles.stepperText, settings.max_iterations === n && styles.stepperTextActive]}>
                {n}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.sheetSectionTitle, { marginTop: spacing.lg }]}>
          Timeout: {settings.timeout_seconds}s
        </Text>
        <View style={styles.stepperRow}>
          {[10, 20, 30, 45, 60].map((n) => (
            <TouchableOpacity
              key={n}
              style={[styles.stepperButton, settings.timeout_seconds === n && styles.stepperActive]}
              onPress={() => dispatch(setCadGenerationSettings({ settings: { timeout_seconds: n } }))}
            >
              <Text style={[styles.stepperText, settings.timeout_seconds === n && styles.stepperTextActive]}>
                {n}s
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function OptionRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.optionRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
      {selected && <FontAwesome name="check" size={14} color={colors.cyan} />}
    </TouchableOpacity>
  );
}

function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          {children}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {},
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.cyanSubtle,
  },
  chipActive: {
    borderColor: colors.cyan,
  },
  chipText: {
    fontSize: fontSizes.badge,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.cyan,
  },
  gearButton: {
    padding: spacing.xs,
  },
  // Bottom sheet
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl + 16,
    borderWidth: 1,
    borderColor: colors.cyanSubtle,
    borderBottomWidth: 0,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textDisabled,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    fontSize: fontSizes.sectionTitle,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  sheetSectionTitle: {
    fontSize: fontSizes.caption,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cyanSubtle,
  },
  optionText: {
    fontSize: fontSizes.body,
    color: colors.textPrimary,
  },
  optionTextSelected: {
    color: colors.cyan,
    fontWeight: '600',
  },
  sizeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  sizeInput: {
    flex: 1,
    alignItems: 'center',
  },
  sizeLabel: {
    fontSize: fontSizes.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  numericInput: {
    width: '100%',
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.cyanSubtle,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  switchLabel: {
    fontSize: fontSizes.body,
    color: colors.textPrimary,
  },
  stepperRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepperButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.cyanSubtle,
    alignItems: 'center',
  },
  stepperActive: {
    borderColor: colors.cyan,
    backgroundColor: colors.cyanSubtle,
  },
  stepperText: {
    fontSize: fontSizes.caption,
    color: colors.textSecondary,
  },
  stepperTextActive: {
    color: colors.cyan,
    fontWeight: '600',
  },
});
