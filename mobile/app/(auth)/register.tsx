import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, borderRadius } from '../../src/theme';
import { registerWithEmail } from '../../src/store/authSlice';
import type { AppDispatch, RootState } from '../../src/store';

export default function RegisterScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const { isLoading } = useSelector((state: RootState) => state.auth);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleRegister = async () => {
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      await dispatch(registerWithEmail({ username, email, password })).unwrap();
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.title}>FITD</Text>
            <Text style={styles.subtitle}>Create your account</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={colors.textDisabled}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              textContentType="username"
            />

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textDisabled}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textDisabled}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor={colors.textDisabled}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              textContentType="newPassword"
            />

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.bgBase} />
              ) : (
                <Text style={styles.buttonText}>Register</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.link}>
                Already have an account? <Text style={styles.linkAccent}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.cyanSubtle,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.cyan,
    textAlign: 'center',
    marginBottom: spacing.xs,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: fontSizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  error: {
    color: colors.error,
    fontSize: fontSizes.caption,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderColor: colors.cyanSubtle,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.cyan,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.bgBase,
    fontSize: fontSizes.body,
    fontWeight: '600',
  },
  link: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  linkAccent: {
    color: colors.cyan,
  },
});
