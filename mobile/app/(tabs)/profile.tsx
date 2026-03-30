import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, fontSizes, borderRadius } from '../../src/theme';
import { logout } from '../../src/store/authSlice';
import type { AppDispatch, RootState } from '../../src/store';

export default function ProfileScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const { user, emailVerified } = useSelector((state: RootState) => state.auth);

  const handleLogout = async () => {
    await dispatch(logout());
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Profile</Text>

        {/* Email Verification Banner */}
        {!emailVerified && (
          <View style={styles.verifyBanner}>
            <FontAwesome name="exclamation-triangle" size={16} color={colors.warning} />
            <Text style={styles.verifyText}>
              Please verify your email to access all features
            </Text>
          </View>
        )}

        {/* User Info */}
        <View style={styles.card}>
          <View style={styles.avatarContainer}>
            <FontAwesome name="user-circle" size={56} color={colors.cyan} />
          </View>
          <Text style={styles.username}>{user?.username || 'User'}</Text>
          <Text style={styles.email}>{user?.email || 'email@example.com'}</Text>
        </View>

        {/* Menu Items */}
        <View style={styles.card}>
          <MenuItem
            icon="shopping-basket"
            label="My Basket"
            onPress={() => console.log('Navigate to basket')}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="history"
            label="Order History"
            onPress={() => console.log('Navigate to order history')}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="magic"
            label="Generation History"
            onPress={() => console.log('Navigate to generation history')}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="cogs"
            label="Fulfiller Settings"
            onPress={() => router.push('/fulfiller-settings')}
          />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <FontAwesome name="sign-out" size={16} color={colors.error} style={styles.logoutIcon} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <FontAwesome name={icon} size={18} color={colors.textSecondary} style={styles.menuIcon} />
      <Text style={styles.menuLabel}>{label}</Text>
      <FontAwesome name="chevron-right" size={12} color={colors.textDisabled} />
    </TouchableOpacity>
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
  title: {
    fontSize: fontSizes.screenTitle,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 145, 0, 0.12)',
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  verifyText: {
    color: colors.warning,
    fontSize: fontSizes.caption,
    flex: 1,
  },
  card: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.cyanSubtle,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  username: {
    fontSize: fontSizes.sectionTitle,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  email: {
    fontSize: fontSizes.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  menuIcon: {
    width: 28,
  },
  menuLabel: {
    flex: 1,
    fontSize: fontSizes.body,
    color: colors.textPrimary,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.cyanSubtle,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSurface,
    borderColor: colors.error,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  logoutIcon: {
    marginRight: spacing.xs,
  },
  logoutText: {
    color: colors.error,
    fontSize: fontSizes.body,
    fontWeight: '600',
  },
});
