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
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, borderRadius } from '../../src/theme';
import { API_URL } from '../../src/services/config';

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async () => {
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Reset failed');
      }
      setSuccess(true);
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
            <Text style={styles.title}>Set New Password</Text>

            {success ? (
              <>
                <Text style={styles.successText}>
                  Password reset successfully. You can now sign in.
                </Text>
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => router.replace('/(auth)/login')}
                >
                  <Text style={styles.buttonText}>Go to Login</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {error ? <Text style={styles.error}>{error}</Text> : null}

                <TextInput
                  style={styles.input}
                  placeholder="New Password"
                  placeholderTextColor={colors.textDisabled}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  textContentType="newPassword"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Confirm New Password"
                  placeholderTextColor={colors.textDisabled}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  textContentType="newPassword"
                />

                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handleReset}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={colors.bgBase} />
                  ) : (
                    <Text style={styles.buttonText}>Reset Password</Text>
                  )}
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
});
