// ─── Dhun Log In Screen ──────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuth } from '@/services/AuthProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { DhunWordmark } from '@/components/DhunWordmark';
import { GoogleIcon } from '@/components/GoogleIcon';
import { GoogleAccountPickerModal, GoogleAccount } from '@/components/GoogleAccountPickerModal';
import { ResetPasswordModal } from '@/components/ResetPasswordModal';
import { getApiBaseUrl, setApiBaseUrl, USB_BASE_URL, LAN_BASE_URL } from '@/services/api/apiClient';

export default function LoginScreen() {
  const { colors, isDark, glass } = useTheme();
  const { loginWithEmail, loginWithGoogle, recentGeneratedPassword, recentEmail, getGeneratedPassword } =
    useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showGooglePicker, setShowGooglePicker] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // Auto-fill recent email if available
  useEffect(() => {
    if (recentEmail && !email) {
      setEmail(recentEmail);
    }
  }, [recentEmail]);

  const handleEmailLogin = async () => {
    setErrorMessage(null);
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Please enter the password generated during signup.');
      return;
    }

    try {
      setLoading(true);
      await loginWithEmail(email, password);
      router.replace('/(tabs)/listen');
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Login failed. Please verify your email and generated password.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setErrorMessage(null);
    setShowGooglePicker(true);
  };

  const handleSelectGoogleAccount = async (account: GoogleAccount) => {
    setShowGooglePicker(false);
    setErrorMessage(null);
    try {
      setGoogleLoading(true);
      await loginWithGoogle(account.email, account.displayName);
      router.replace('/(tabs)/listen');
    } catch (err: any) {
      setErrorMessage(err.message || 'Google sign-in failed. Please ensure the backend is connected.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const fillRecentPassword = () => {
    if (recentGeneratedPassword) {
      setPassword(recentGeneratedPassword);
      if (recentEmail) setEmail(recentEmail);
    } else {
      const stored = getGeneratedPassword(email);
      if (stored) setPassword(stored);
    }
  };

  const fillDemoAccount = () => {
    setEmail('arjun@email.com');
    setPassword('dhun-alap-2026');
    setErrorMessage(null);
  };

  const availablePasswordHint = recentGeneratedPassword || (email ? getGeneratedPassword(email) : null);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing['2xl'] },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Wordmark & Intro */}
        <View style={styles.brandHeader}>
          <DhunWordmark size="medium" />
          <Text style={[typography.h1, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
            Welcome Back
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}>
            Sign in with Google or your generated email password.
          </Text>
        </View>

        {/* Error Alert Banner */}
        {errorMessage ? (
          <View style={[styles.errorBanner, { backgroundColor: 'rgba(224, 97, 74, 0.15)', borderColor: colors.error }]}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[typography.bodySmall, { color: colors.error }]}>
                {errorMessage}
              </Text>
              {(errorMessage.includes('Failed to connect') ||
                errorMessage.includes('ConnectException') ||
                errorMessage.includes('NETWORK_ERROR') ||
                errorMessage.includes('Unable to connect')) && (
                <Pressable
                  onPress={() => {
                    const current = getApiBaseUrl();
                    const next = current.includes('127.0.0.1') ? LAN_BASE_URL : USB_BASE_URL;
                    setApiBaseUrl(next);
                    setErrorMessage(null);
                  }}
                  style={{ marginTop: 6, alignSelf: 'flex-start' }}
                >
                  <Text style={[typography.caption, { color: colors.accent, fontWeight: '700', textDecorationLine: 'underline' }]}>
                    {getApiBaseUrl().includes('127.0.0.1')
                      ? '⚡ Switch to Wi-Fi Server (192.168.1.17)'
                      : '⚡ Switch to USB Server (127.0.0.1)'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : null}

        {/* Google Login Button */}
        <Pressable
          onPress={handleGoogleLogin}
          disabled={googleLoading || loading}
          style={({ pressed }) => [
            styles.googleButton,
            {
              backgroundColor: glass.surfaceCard,
              borderColor: glass.border,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
        >
          {googleLoading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <>
              <GoogleIcon size={20} />
              <Text style={[styles.googleButtonText, { color: colors.textPrimary }]}>
                Continue with Google
              </Text>
            </>
          )}
        </Pressable>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.borderSubtle }]} />
          <Text style={[typography.caption, { color: colors.textMuted, marginHorizontal: spacing.md }]}>
            or log in with email
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.borderSubtle }]} />
        </View>

        {/* Email & Password Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
              Email Address
            </Text>
            <View style={[styles.inputContainer, { backgroundColor: glass.surfaceSubtle, borderColor: glass.border }]}>
              <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { color: colors.textPrimary }]}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.passwordLabelRow}>
              <Text style={[typography.label, { color: colors.textSecondary }]}>
                Generated Password
              </Text>
              {availablePasswordHint && !password ? (
                <Pressable onPress={fillRecentPassword} hitSlop={6}>
                  <Text style={[typography.caption, { color: colors.accent, fontWeight: '600' }]}>
                    Paste Generated Password
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View style={[styles.inputContainer, { backgroundColor: glass.surfaceSubtle, borderColor: glass.border }]}>
              <Ionicons name="key-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password from signup"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                style={[
                  styles.input,
                  {
                    color: colors.textPrimary,
                    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
                  },
                ]}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8} style={styles.eyeIcon}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>
            <View style={styles.passwordFooterRow}>
              <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]}>
                Use your generated password.
              </Text>
              <Pressable
                onPress={() => setShowResetModal(true)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Reset Password"
              >
                <Text style={[typography.caption, { color: colors.accentWarm || '#FFD700', fontWeight: '700' }]}>
                  Reset Password?
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Quick Demo Helper Card */}
          <Pressable
            onPress={fillDemoAccount}
            style={({ pressed }) => [
              styles.demoCard,
              {
                backgroundColor: glass.surfaceSubtle,
                borderColor: glass.borderAccent,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons name="flash-outline" size={16} color={colors.accent} />
            <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: spacing.xs, flex: 1 }]}>
              Quick Demo: Use <Text style={{ color: colors.accent, fontWeight: '600' }}>arjun@email.com</Text>
            </Text>
            <Text style={[typography.caption, { color: colors.accent, fontWeight: '600' }]}>
              Auto-fill
            </Text>
          </Pressable>

          {/* Submit Button */}
          <Pressable
            onPress={handleEmailLogin}
            disabled={loading || googleLoading}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: colors.accent,
                opacity: pressed || loading ? 0.85 : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#101312" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Log In</Text>
            )}
          </Pressable>
        </View>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <View style={styles.signupRow}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              New to Dhun?{' '}
            </Text>
            <Pressable onPress={() => router.push('/signup')} hitSlop={8}>
              <Text style={[typography.body, { color: colors.accent, fontWeight: '600' }]}>
                Sign Up
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => router.replace('/(tabs)/listen')}
            hitSlop={8}
            style={styles.guestButton}
          >
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Explore Dhun as Guest
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Google Account Picker Sheet */}
      <GoogleAccountPickerModal
        visible={showGooglePicker}
        loading={googleLoading}
        onClose={() => setShowGooglePicker(false)}
        onSelectAccount={handleSelectGoogleAccount}
      />

      {/* Reset Password Modal */}
      <ResetPasswordModal
        visible={showResetModal}
        initialEmail={email}
        onClose={() => setShowResetModal(false)}
        onSuccess={({ email: resetEmail, newPassword: resetPass }) => {
          setEmail(resetEmail);
          setPassword(resetPass);
          setErrorMessage(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  passwordFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  screen: {
    flex: 1,
  },
  scrollContainer: {
    paddingHorizontal: spacing.xl,
    flexGrow: 1,
    justifyContent: 'center',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: radius.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    marginBottom: spacing.xl,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: spacing.md,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
  },
  eyeIcon: {
    padding: spacing.xs,
  },
  demoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.xl,
  },
  primaryButton: {
    height: 50,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#D7A65A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#101312',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing['2xl'],
  },
  signupRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guestButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.xs,
  },
});
