import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, fontSizes, borderRadius } from '../src/theme';

export default function FulfillerSettingsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Stripe Payments */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <FontAwesome name="credit-card" size={20} color={colors.cyan} />
            <Text style={styles.sectionTitle}>Stripe Payments</Text>
          </View>
          <Text style={styles.description}>
            Connect your Stripe account to receive payouts for fulfilled orders.
          </Text>
          <View style={styles.comingSoon}>
            <Text style={styles.comingSoonText}>Coming soon</Text>
          </View>
        </View>

        {/* Manufacturing Capabilities */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <FontAwesome name="industry" size={20} color={colors.cyan} />
            <Text style={styles.sectionTitle}>Manufacturing Capabilities</Text>
          </View>
          <Text style={styles.description}>
            Configure your available processes, materials, and machine specifications.
          </Text>
          <View style={styles.comingSoon}>
            <Text style={styles.comingSoonText}>Coming soon</Text>
          </View>
        </View>

        {/* Shipping Address */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <FontAwesome name="map-marker" size={20} color={colors.cyan} />
            <Text style={styles.sectionTitle}>Shipping Address</Text>
          </View>
          <Text style={styles.description}>
            Set your shipping origin for accurate rate calculation.
          </Text>
          <View style={styles.comingSoon}>
            <Text style={styles.comingSoonText}>Coming soon</Text>
          </View>
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSizes.sectionTitle,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  description: {
    fontSize: fontSizes.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  comingSoon: {
    backgroundColor: colors.cyanSubtle,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  comingSoonText: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    fontWeight: '500',
    fontStyle: 'italic',
  },
});
