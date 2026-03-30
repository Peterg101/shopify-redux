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

const CLAIM_STEPS = [
  { key: 'pending', label: 'Pending', icon: 'clock-o' as const },
  { key: 'in_progress', label: 'In Progress', icon: 'wrench' as const },
  { key: 'printing', label: 'Printing', icon: 'print' as const },
  { key: 'qa_check', label: 'QA Check', icon: 'check-circle-o' as const },
  { key: 'shipped', label: 'Shipped', icon: 'truck' as const },
  { key: 'delivered', label: 'Delivered', icon: 'home' as const },
];

export default function ClaimDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentStep = 0; // Placeholder — will come from API

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Claim Header */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Claim {id}</Text>
          <View style={styles.statusChip}>
            <Text style={styles.statusText}>Pending</Text>
          </View>
        </View>

        {/* Status Stepper */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Progress</Text>
          {CLAIM_STEPS.map((step, index) => (
            <View key={step.key} style={styles.stepRow}>
              <View
                style={[
                  styles.stepDot,
                  index <= currentStep && styles.stepDotActive,
                ]}
              >
                <FontAwesome
                  name={step.icon}
                  size={14}
                  color={index <= currentStep ? colors.bgBase : colors.textDisabled}
                />
              </View>
              {index < CLAIM_STEPS.length - 1 && (
                <View
                  style={[
                    styles.stepLine,
                    index < currentStep && styles.stepLineActive,
                  ]}
                />
              )}
              <Text
                style={[
                  styles.stepLabel,
                  index <= currentStep && styles.stepLabelActive,
                ]}
              >
                {step.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Update Status */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Update Status</Text>
          <TouchableOpacity style={styles.updateButton}>
            <Text style={styles.updateButtonText}>Advance to Next Step</Text>
          </TouchableOpacity>
        </View>

        {/* Order Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order Information</Text>
          <Text style={styles.placeholderText}>
            Order details will be loaded here
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  statusChip: {
    alignSelf: 'flex-start',
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
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    position: 'relative',
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgInput,
    borderColor: colors.textDisabled,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: colors.cyan,
    borderColor: colors.cyan,
  },
  stepLine: {
    position: 'absolute',
    left: 15,
    top: 32,
    width: 2,
    height: spacing.md,
    backgroundColor: colors.textDisabled,
  },
  stepLineActive: {
    backgroundColor: colors.cyan,
  },
  stepLabel: {
    marginLeft: spacing.md,
    fontSize: fontSizes.body,
    color: colors.textDisabled,
  },
  stepLabelActive: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  updateButton: {
    backgroundColor: colors.cyan,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  updateButtonText: {
    color: colors.bgBase,
    fontSize: fontSizes.body,
    fontWeight: '600',
  },
  placeholderText: {
    color: colors.textDisabled,
    fontSize: fontSizes.body,
  },
});
