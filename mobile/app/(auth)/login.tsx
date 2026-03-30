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
import { loginWithEmail } from '../../src/store/authSlice';
import type { AppDispatch, RootState } from '../../src/store';

export default function LoginScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const { isLoading } = useSelector((state: RootState) => state.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    try {
      await dispatch(loginWithEmail({ email, password })).unwrap();
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  const handleGoogleLogin = () => {
    console.log('Google login — not yet implemented');
  };

  const handleGithubLogin = () => {
    console.log('GitHub login — not yet implemented');
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
            <Text style={styles.subtitle}>Sign in to your account</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

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
              textContentType="password"
            />

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.bgBase} />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.oauthButton} onPress={handleGoogleLogin}>
              <Text style={styles.oauthButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.oauthButton} onPress={handleGithubLogin}>
              <Text style={styles.oauthButtonText}>Continue with GitHub</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={styles.link}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.link}>
                Don't have an account? <Text style={styles.linkAccent}>Register</Text>
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.cyanSubtle,
  },
  dividerText: {
    color: colors.textSecondary,
    marginHorizontal: spacing.md,
    fontSize: fontSizes.caption,
  },
  oauthButton: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.cyanSubtle,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  oauthButtonText: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: '500',
  },
  link: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  linkAccent: {
    color: colors.cyan,
  },
});
