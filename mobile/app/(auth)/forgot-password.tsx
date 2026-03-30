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
} from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, borderRadius } from '../../src/theme';
import { API_URL } from '../../src/services/config';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Request failed');
      }
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.title}>Reset Password</Text>

            {sent ? (
              <>
                <Text style={styles.successText}>
                  If an account exists for {email}, a reset link has been sent.
                </Text>
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => router.push('/(auth)/login')}
                >
                  <Text style={styles.buttonText}>Back to Login</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.subtitle}>
                  Enter your email and we'll send you a reset link.
                </Text>

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

                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handleSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={colors.bgBase} />
                  ) : (
                    <Text style={styles.buttonText}>Send Reset Link</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                  <Text style={styles.link}>Back to Login</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
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
  content: {
    flex: 1,
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
    fontSize: fontSizes.screenTitle,
    fontWeight: '700',
    color: colors.cyan,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  successText: {
    fontSize: fontSizes.body,
    color: colors.success,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
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
    color: colors.cyan,
    fontSize: fontSizes.caption,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
