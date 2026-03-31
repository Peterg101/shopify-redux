import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSelector } from 'react-redux';
import { colors, spacing, fontSizes, borderRadius } from '../src/theme';
import { api } from '../src/services/api';
import { API_URL } from '../src/services/config';
import { getToken } from '../src/services/auth';
import type { RootState } from '../src/store';

export default function FulfillerSettingsScreen() {
  const { user, stripeOnboarded, hasFulfillerProfile } = useSelector((state: RootState) => state.auth);
  const userId = user?.user_id;

  const { data: address, isLoading: loadingAddress } = api.useGetFulfillerAddressQuery(userId!, { skip: !userId });
  const { data: processes } = api.useGetManufacturingProcessesQuery(undefined);
  const { data: profile, isLoading: loadingProfile } = api.useGetFulfillerProfileQuery(userId!, { skip: !userId });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Stripe Payments */}
        <StripeSection onboarded={stripeOnboarded} />

        {/* Manufacturing Capabilities */}
        <CapabilitiesSection
          profile={profile}
          processes={processes}
          loading={loadingProfile}
          hasFulfillerProfile={hasFulfillerProfile}
        />

        {/* Shipping Address */}
        {hasFulfillerProfile && (
          <AddressSection
            address={address}
            loading={loadingAddress}
            userId={userId!}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StripeSection({ onboarded }: { onboarded: boolean }) {
  const [loading, setLoading] = useState(false);

  const handleSetupStripe = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/stripe/onboard`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.url) {
        Alert.alert('Stripe Setup', 'Opening Stripe onboarding in your browser...');
        // In production: use expo-web-browser to open data.url
      }
    } catch {
      Alert.alert('Error', 'Failed to start Stripe onboarding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <FontAwesome name="credit-card" size={20} color={colors.cyan} />
        <Text style={styles.sectionTitle}>Stripe Payments</Text>
        {onboarded && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
        )}
      </View>

      {onboarded ? (
        <Text style={styles.description}>
          Your Stripe account is connected. You'll receive payouts for fulfilled orders.
        </Text>
      ) : (
        <>
          <Text style={styles.description}>
            Connect your Stripe account to receive payouts for fulfilled orders.
          </Text>
          <TouchableOpacity
            style={[styles.actionButton, loading && { opacity: 0.5 }]}
            onPress={handleSetupStripe}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.bgBase} />
            ) : (
              <>
                <FontAwesome name="external-link" size={14} color={colors.bgBase} />
                <Text style={styles.actionButtonText}>Set Up Payments</Text>
              </>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function CapabilitiesSection({ profile, processes, loading, hasFulfillerProfile }: {
  profile: any;
  processes: any;
  loading: boolean;
  hasFulfillerProfile: boolean;
}) {
  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <FontAwesome name="industry" size={20} color={colors.cyan} />
          <Text style={styles.sectionTitle}>Manufacturing Capabilities</Text>
        </View>
        <ActivityIndicator color={colors.cyan} style={{ padding: spacing.lg }} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <FontAwesome name="industry" size={20} color={colors.cyan} />
        <Text style={styles.sectionTitle}>Manufacturing Capabilities</Text>
        {hasFulfillerProfile && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
        )}
      </View>

      {profile ? (
        <>
          {profile.business_name && (
            <Text style={styles.businessName}>{profile.business_name}</Text>
          )}
          {profile.description && (
            <Text style={styles.description}>{profile.description}</Text>
          )}

          {profile.capabilities && profile.capabilities.length > 0 && (
            <View style={styles.capabilityList}>
              {profile.capabilities.map((cap: any, i: number) => (
                <View key={i} style={styles.capabilityItem}>
                  <FontAwesome name="check-circle" size={14} color={colors.success} />
                  <Text style={styles.capabilityText}>
                    {cap.process_name} — {cap.material_names?.join(', ') || 'All materials'}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {profile.min_tolerance_mm && (
            <MetaRow label="Min Tolerance" value={`${profile.min_tolerance_mm}mm`} />
          )}
          {profile.lead_time_days_min && profile.lead_time_days_max && (
            <MetaRow label="Lead Time" value={`${profile.lead_time_days_min}–${profile.lead_time_days_max} days`} />
          )}
        </>
      ) : (
        <>
          <Text style={styles.description}>
            Set up your manufacturing profile to appear in the marketplace and claim orders.
          </Text>
          <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert('Coming Soon', 'Profile creation will be available in the next update.')}>
            <FontAwesome name="plus" size={14} color={colors.bgBase} />
            <Text style={styles.actionButtonText}>Set Up Profile</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function AddressSection({ address, loading, userId }: { address: any; loading: boolean; userId: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('GB');
  const [saving, setSaving] = useState(false);

  const [updateAddress] = api.useUpdateFulfillerAddressMutation();

  const startEditing = () => {
    if (address) {
      setName(address.name || '');
      setLine1(address.line1 || '');
      setCity(address.city || '');
      setPostalCode(address.postal_code || '');
      setCountry(address.country || 'GB');
    }
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAddress({
        userId,
        address: { name, line1, city, postal_code: postalCode, country },
      }).unwrap();
      setEditing(false);
      Alert.alert('Saved', 'Shipping address updated.');
    } catch {
      Alert.alert('Error', 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <FontAwesome name="map-marker" size={20} color={colors.cyan} />
          <Text style={styles.sectionTitle}>Shipping Address</Text>
        </View>
        <ActivityIndicator color={colors.cyan} style={{ padding: spacing.lg }} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <FontAwesome name="map-marker" size={20} color={colors.cyan} />
        <Text style={styles.sectionTitle}>Shipping Address</Text>
        {!editing && (
          <TouchableOpacity onPress={startEditing}>
            <FontAwesome name="pencil" size={16} color={colors.cyan} />
          </TouchableOpacity>
        )}
      </View>

      {editing ? (
        <View style={styles.formFields}>
          <TextInput style={styles.input} placeholder="Name" placeholderTextColor={colors.textDisabled} value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Address Line 1" placeholderTextColor={colors.textDisabled} value={line1} onChangeText={setLine1} />
          <TextInput style={styles.input} placeholder="City" placeholderTextColor={colors.textDisabled} value={city} onChangeText={setCity} />
          <TextInput style={styles.input} placeholder="Postal Code" placeholderTextColor={colors.textDisabled} value={postalCode} onChangeText={setPostalCode} />
          <TextInput style={styles.input} placeholder="Country Code (e.g. GB)" placeholderTextColor={colors.textDisabled} value={country} onChangeText={setCountry} autoCapitalize="characters" maxLength={2} />

          <View style={styles.formButtons}>
            <TouchableOpacity style={styles.cancelFormButton} onPress={() => setEditing(false)}>
              <Text style={styles.cancelFormText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { flex: 1 }, saving && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.bgBase} />
              ) : (
                <Text style={styles.actionButtonText}>Save Address</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : address ? (
        <View>
          <Text style={styles.addressLine}>{address.name}</Text>
          <Text style={styles.addressLine}>{address.line1}</Text>
          <Text style={styles.addressLine}>{address.city}, {address.postal_code}</Text>
          <Text style={styles.addressLine}>{address.country}</Text>
        </View>
      ) : (
        <View>
          <Text style={styles.description}>No shipping address set.</Text>
          <TouchableOpacity style={styles.actionButton} onPress={startEditing}>
            <FontAwesome name="plus" size={14} color={colors.bgBase} />
            <Text style={styles.actionButtonText}>Add Address</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
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
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.bgSurface, borderColor: colors.cyanSubtle, borderWidth: 1,
    borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSizes.sectionTitle, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  description: { fontSize: fontSizes.body, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.lg },
  businessName: { fontSize: fontSizes.cardTitle, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs },
  activeBadge: {
    backgroundColor: 'rgba(105, 240, 174, 0.15)', borderColor: colors.success, borderWidth: 1,
    borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  activeBadgeText: { fontSize: fontSizes.badge, color: colors.success, fontWeight: '600' },
  actionButton: {
    backgroundColor: colors.cyan, borderRadius: borderRadius.lg, paddingVertical: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  actionButtonText: { color: colors.bgBase, fontSize: fontSizes.body, fontWeight: '600' },
  capabilityList: { gap: spacing.sm, marginBottom: spacing.md },
  capabilityItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  capabilityText: { fontSize: fontSizes.body, color: colors.textPrimary },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.cyanSubtle, marginTop: spacing.xs,
  },
  metaLabel: { color: colors.textSecondary, fontSize: fontSizes.body },
  metaValue: { color: colors.textPrimary, fontSize: fontSizes.body, fontWeight: '500' },
  addressLine: { fontSize: fontSizes.body, color: colors.textSecondary, lineHeight: 24 },
  formFields: { gap: spacing.md },
  input: {
    backgroundColor: colors.bgInput, borderColor: colors.cyanSubtle, borderWidth: 1,
    borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    color: colors.textPrimary, fontSize: fontSizes.body,
  },
  formButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  cancelFormButton: {
    borderColor: colors.textDisabled, borderWidth: 1, borderRadius: borderRadius.lg,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg, alignItems: 'center',
  },
  cancelFormText: { color: colors.textSecondary, fontSize: fontSizes.body },
});
