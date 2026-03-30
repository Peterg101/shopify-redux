import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, fontSizes, borderRadius } from '../../src/theme';
import { statusColors } from '../../src/theme/colors';
import { logout } from '../../src/store/authSlice';
import { api } from '../../src/services/api';
import type { AppDispatch, RootState } from '../../src/store';

type Section = 'basket' | 'orders' | null;

export default function ProfileScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const { user, emailVerified, stripeOnboarded, hasFulfillerProfile } = useSelector((state: RootState) => state.auth);
  const [openSection, setOpenSection] = useState<Section>(null);

  const { data: basket, isLoading: loadingBasket, refetch: refetchBasket } = api.useGetUserBasketQuery(undefined);
  const { data: orders, isLoading: loadingOrders, refetch: refetchOrders } = api.useGetUserOrdersQuery(undefined);

  const handleLogout = async () => {
    await dispatch(logout());
    router.replace('/(auth)/login');
  };

  const toggleSection = (section: Section) => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => { refetchBasket(); refetchOrders(); }}
            tintColor={colors.cyan}
          />
        }
      >
        <Text style={styles.title}>Profile</Text>

        {/* Email Verification Banner */}
        {!emailVerified && (
          <View style={styles.verifyBanner}>
            <FontAwesome name="exclamation-triangle" size={16} color={colors.warning} />
            <Text style={styles.verifyText}>Please verify your email to access all features</Text>
          </View>
        )}

        {/* User Info */}
        <View style={styles.card}>
          <View style={styles.avatarContainer}>
            <FontAwesome name="user-circle" size={56} color={colors.cyan} />
          </View>
          <Text style={styles.username}>{user?.username || 'User'}</Text>
          <Text style={styles.email}>{user?.email || ''}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{basket?.length ?? 0}</Text>
              <Text style={styles.statLabel}>Basket</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{orders?.length ?? 0}</Text>
              <Text style={styles.statLabel}>Orders</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: stripeOnboarded ? colors.success : colors.textDisabled }]}>
                {stripeOnboarded ? '✓' : '—'}
              </Text>
              <Text style={styles.statLabel}>Stripe</Text>
            </View>
          </View>
        </View>

        {/* Basket Section */}
        <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('basket')}>
          <FontAwesome name="shopping-basket" size={18} color={colors.textSecondary} style={styles.menuIcon} />
          <Text style={styles.menuLabel}>My Basket</Text>
          {basket && basket.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{basket.length}</Text>
            </View>
          )}
          <FontAwesome name={openSection === 'basket' ? 'chevron-down' : 'chevron-right'} size={12} color={colors.textDisabled} />
        </TouchableOpacity>

        {openSection === 'basket' && (
          <View style={styles.sectionContent}>
            {loadingBasket ? (
              <ActivityIndicator color={colors.cyan} style={{ padding: spacing.lg }} />
            ) : !basket || basket.length === 0 ? (
              <Text style={styles.emptyText}>Your basket is empty</Text>
            ) : (
              basket.map((item: any) => (
                <View key={item.task_id || item.name} style={styles.listItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.itemDetail}>{item.material} · {item.technique} · ×{item.quantity}</Text>
                  </View>
                  <Text style={styles.itemPrice}>£{(item.price * item.quantity).toFixed(2)}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* Orders Section */}
        <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('orders')}>
          <FontAwesome name="history" size={18} color={colors.textSecondary} style={styles.menuIcon} />
          <Text style={styles.menuLabel}>Order History</Text>
          {orders && orders.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{orders.length}</Text>
            </View>
          )}
          <FontAwesome name={openSection === 'orders' ? 'chevron-down' : 'chevron-right'} size={12} color={colors.textDisabled} />
        </TouchableOpacity>

        {openSection === 'orders' && (
          <View style={styles.sectionContent}>
            {loadingOrders ? (
              <ActivityIndicator color={colors.cyan} style={{ padding: spacing.lg }} />
            ) : !orders || orders.length === 0 ? (
              <Text style={styles.emptyText}>No orders yet</Text>
            ) : (
              orders.map((order: any) => (
                <TouchableOpacity
                  key={order.order_id}
                  style={styles.listItem}
                  onPress={() => router.push(`/order/${order.order_id}`)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>{order.name}</Text>
                    <Text style={styles.itemDetail}>{order.material} · ×{order.quantity}</Text>
                  </View>
                  <View style={styles.orderRight}>
                    <View style={[styles.statusDot, {
                      backgroundColor: statusColors[order.status as keyof typeof statusColors] || colors.textSecondary
                    }]} />
                    <FontAwesome name="chevron-right" size={10} color={colors.textDisabled} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Fulfiller Settings */}
        <TouchableOpacity style={styles.sectionHeader} onPress={() => router.push('/fulfiller-settings')}>
          <FontAwesome name="cogs" size={18} color={colors.textSecondary} style={styles.menuIcon} />
          <Text style={styles.menuLabel}>Fulfiller Settings</Text>
          {hasFulfillerProfile && (
            <View style={[styles.countBadge, { backgroundColor: 'rgba(105, 240, 174, 0.15)', borderColor: colors.success }]}>
              <Text style={[styles.countText, { color: colors.success }]}>Active</Text>
            </View>
          )}
          <FontAwesome name="chevron-right" size={12} color={colors.textDisabled} />
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <FontAwesome name="sign-out" size={16} color={colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { fontSize: fontSizes.screenTitle, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.lg },
  verifyBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 145, 0, 0.12)',
    borderColor: colors.warning, borderWidth: 1, borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.lg, gap: spacing.sm,
  },
  verifyText: { color: colors.warning, fontSize: fontSizes.caption, flex: 1 },
  card: {
    backgroundColor: colors.bgSurface, borderColor: colors.cyanSubtle, borderWidth: 1,
    borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg,
  },
  avatarContainer: { alignItems: 'center', marginBottom: spacing.md },
  username: { fontSize: fontSizes.sectionTitle, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  email: { fontSize: fontSizes.caption, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  statsRow: { flexDirection: 'row', marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.cyanSubtle },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: fontSizes.sectionTitle, fontWeight: '700', color: colors.cyan, fontFamily: 'SpaceMono' },
  statLabel: { fontSize: fontSizes.badge, color: colors.textDisabled, marginTop: spacing.xs },
  statDivider: { width: 1, backgroundColor: colors.cyanSubtle },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSurface,
    borderColor: colors.cyanSubtle, borderWidth: 1, borderRadius: borderRadius.lg,
    padding: spacing.lg, marginBottom: 2,
  },
  menuIcon: { width: 28 },
  menuLabel: { flex: 1, fontSize: fontSizes.body, color: colors.textPrimary },
  countBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)', borderColor: colors.cyan, borderWidth: 1,
    borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: 1, marginRight: spacing.sm,
  },
  countText: { fontSize: fontSizes.badge, color: colors.cyan, fontWeight: '600' },
  sectionContent: {
    backgroundColor: colors.bgSurface, borderColor: colors.cyanSubtle, borderWidth: 1,
    borderTopWidth: 0, borderBottomLeftRadius: borderRadius.lg, borderBottomRightRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  emptyText: { color: colors.textDisabled, fontSize: fontSizes.body, textAlign: 'center', padding: spacing.lg },
  listItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.cyanSubtle,
  },
  itemName: { fontSize: fontSizes.body, fontWeight: '600', color: colors.textPrimary },
  itemDetail: { fontSize: fontSizes.caption, color: colors.textSecondary, marginTop: 2 },
  itemPrice: { fontSize: fontSizes.body, fontWeight: '700', color: colors.cyan, fontFamily: 'SpaceMono' },
  orderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgSurface, borderColor: colors.error, borderWidth: 1,
    borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.sm, marginTop: spacing.lg,
  },
  logoutText: { color: colors.error, fontSize: fontSizes.body, fontWeight: '600' },
});
