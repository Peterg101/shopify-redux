import { Link, Stack } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, fontSizes, borderRadius } from '../src/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found', headerShown: false }} />
      <View style={styles.container}>
        <FontAwesome name="map-signs" size={64} color={colors.textDisabled} />
        <Text style={styles.title}>Page Not Found</Text>
        <Text style={styles.subtitle}>
          The screen you're looking for doesn't exist.
        </Text>
        <Link href="/" style={styles.button}>
          <Text style={styles.buttonText}>Go Home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: fontSizes.screenTitle,
    fontWeight: '700',
    color: colors.cyan,
    marginTop: spacing.lg,
  },
  subtitle: {
    fontSize: fontSizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.cyan,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  buttonText: {
    color: colors.bgBase,
    fontSize: fontSizes.body,
    fontWeight: '600',
  },
});
