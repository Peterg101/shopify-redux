import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, borderRadius } from '../../src/theme';
import { API_URL } from '../../src/services/config';

export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('No verification token provided');
      return;
    }
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    setStatus('loading');
    try {
      const res = await fetch(`${API_URL}/auth/verify-email?token=${token}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Verification failed');
      }
      setStatus('success');
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Verification failed');
    }
  };

  const handleResend = async () => {
    try {
      await fetch(`${API_URL}/auth/resend-verification`, { method: 'POST' });
      setErrorMessage('Verification email resent. Check your inbox.');
    } catch {
      setErrorMessage('Failed to resend verification email');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Email Verification</Text>

          {status === 'loading' && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.cyan} />
              <Text style={styles.loadingText}>Verifying your email...</Text>
            </View>
          )}

          {status === 'success' && (
            <>
              <Text style={styles.successText}>
                Email verified successfully!
              </Text>
              <TouchableOpacity
                style={styles.button}
                onPress={() => router.replace('/(tabs)')}
              >
                <Text style={styles.buttonText}>Continue to App</Text>
              </TouchableOpacity>
            </>
          )}

          {status === 'error' && (
            <>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity style={styles.button} onPress={handleResend}>
                <Text style={styles.buttonText}>Resend Verification</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.link}>Back to Login</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
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
    marginBottom: spacing.xl,
  },
  center: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    marginTop: spacing.lg,
  },
  successText: {
    fontSize: fontSizes.body,
    color: colors.success,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  errorText: {
    fontSize: fontSizes.body,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  button: {
    backgroundColor: colors.cyan,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
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
