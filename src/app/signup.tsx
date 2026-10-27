// ─── Dhun Sign Up Screen ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
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
import { GlassSurface } from '@/components/GlassSurface';
import { GoogleAccountPickerModal, GoogleAccount } from '@/components/GoogleAccountPickerModal';

export default function SignUpScreen() {
  const { colors, isDark, glass } = useTheme();
  const { signupWithEmail, signupWithGoogle } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showGooglePicker, setShowGooglePicker] = useState(false);

  // Generated password reveal modal state
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [isPasswordRevealed, setIsPasswordRevealed] = useState(true);
  const [hasCopied, setHasCopied] = useState(false);

  const handleEmailSignUp = async () => {
    setErrorMessage(null);
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    try {
      setLoading(true);
      const result = await signupWithEmail(email, name);
      setGeneratedPassword(result.generatedPassword);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    setErrorMessage(null);
    setShowGooglePicker(true);
  };

  const handleSelectGoogleAccount = async (account: GoogleAccount) => {
    setShowGooglePicker(false);
    setErrorMessage(null);
    try {
      setGoogleLoading(true);
      await signupWithGoogle(account.email, account.displayName);
      router.replace('/(tabs)/listen');
    } catch (err: any) {
      setErrorMessage(err.message || 'Google sign-up failed. Please ensure the backend is connected.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!generatedPassword) return;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(generatedPassword);
      }
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2500);
    } catch {
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2500);
    }
  };

  const handleCompleteSignUp = () => {
    setGeneratedPassword(null);
    router.replace('/(tabs)/listen');
  };

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
            Create Account
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}>
            Lossless audio & personal music, crafted for emotion.
          </Text>
        </View>

        {/* Error Alert Banner */}
        {errorMessage ? (
          <View style={[styles.errorBanner, { backgroundColor: 'rgba(224, 97, 74, 0.15)', borderColor: colors.error }]}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={[typography.bodySmall, { color: colors.error, marginLeft: spacing.sm, flex: 1 }]}>
              {errorMessage}
            </Text>
          </View>
        ) : null}

        {/* Google Signup Button */}
        <Pressable
          onPress={handleGoogleSignUp}
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
                Sign up with Google
              </Text>
            </>
          )}
        </Pressable>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.borderSubtle }]} />
          <Text style={[typography.caption, { color: colors.textMuted, marginHorizontal: spacing.md }]}>
            or sign up with email
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.borderSubtle }]} />
        </View>

        {/* Email Signup Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
              Full Name (Optional)
            </Text>
            <View style={[styles.inputContainer, { backgroundColor: glass.surfaceSubtle, borderColor: glass.border }]}>
              <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Arjun Mehta"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { color: colors.textPrimary }]}
                autoCapitalize="words"
              />
            </View>
          </View>

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

          {/* Generated Password Informational Notice */}
          <View
            style={[
              styles.noticeCard,
              { backgroundColor: glass.surfaceSubtle, borderColor: glass.borderAccent },
            ]}
          >
            <Ionicons name="key-outline" size={20} color={colors.accent} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[typography.label, { color: colors.accent, fontWeight: '600' }]}>
                Automatic Password Generation
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                Dhun generates a secure, musical password for your account automatically. You won’t need to create one now.
              </Text>
            </View>
          </View>

          {/* Submit Button */}
          <Pressable
            onPress={handleEmailSignUp}
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
              <Text style={styles.primaryButtonText}>Sign Up & Generate Password</Text>
            )}
          </Pressable>
        </View>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <View style={styles.loginRow}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              Already have an account?{' '}
            </Text>
            <Pressable onPress={() => router.push('/login')} hitSlop={8}>
              <Text style={[typography.body, { color: colors.accent, fontWeight: '600' }]}>
                Log In
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

      {/* ─── Generated Password Dialog Modal ────────────────────────────── */}
      <Modal
        visible={!!generatedPassword}
        transparent
        animationType="fade"
        onRequestClose={handleCompleteSignUp}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <GlassSurface
            variant="elevated"
            showTopHighlight
            style={styles.modalCard}
          >
            <View style={[styles.modalBadge, { backgroundColor: colors.accentSubtle }]}>
              <Ionicons name="sparkles" size={24} color={colors.accent} />
            </View>

            <Text style={[typography.h2, { color: colors.textPrimary, textAlign: 'center', marginTop: spacing.md }]}>
              Account Created!
            </Text>

            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }]}>
              Here is your generated password for <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{email}</Text>:
            </Text>

            {/* Password Reveal Box */}
            <View
              style={[
                styles.passwordBox,
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.passwordText,
                  { color: colors.accentWarm },
                ]}
                selectable
              >
                {isPasswordRevealed
                  ? generatedPassword
                  : '••••••••••••••••'}
              </Text>

              <Pressable
                onPress={() => setIsPasswordRevealed(!isPasswordRevealed)}
                hitSlop={8}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={isPasswordRevealed ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>

            {/* Copy Button */}
            <Pressable
              onPress={copyToClipboard}
              style={({ pressed }) => [
                styles.copyButton,
                {
                  borderColor: hasCopied ? colors.success : colors.border,
                  backgroundColor: hasCopied ? 'rgba(92, 184, 112, 0.12)' : colors.surface,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Ionicons
                name={hasCopied ? 'checkmark-circle' : 'copy-outline'}
                size={18}
                color={hasCopied ? colors.success : colors.textPrimary}
              />
              <Text
                style={[
                  typography.label,
                  {
                    color: hasCopied ? colors.success : colors.textPrimary,
                    marginLeft: spacing.sm,
                    fontWeight: '600',
                  },
                ]}
              >
                {hasCopied ? 'Password Copied to Clipboard!' : 'Copy Generated Password'}
              </Text>
            </Pressable>

            {/* Advisory Note */}
            <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.md }]}>
              Save this password safely. You will use this exact password to log in with your email.
            </Text>

            {/* Enter App Primary CTA */}
            <Pressable
              onPress={handleCompleteSignUp}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: colors.accent,
                  marginTop: spacing.xl,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <Text style={styles.primaryButtonText}>Enter Dhun</Text>
            </Pressable>
          </GlassSurface>
        </View>
      </Modal>

      {/* Google Account Picker Modal */}
      <GoogleAccountPickerModal
        visible={showGooglePicker}
        loading={googleLoading}
        onClose={() => setShowGooglePicker(false)}
        onSelectAccount={handleSelectGoogleAccount}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  noticeCard: {
    flexDirection: 'row',
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
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guestButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.xs,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passwordBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    marginTop: spacing.lg,
  },
  passwordText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1.2,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
  },
  eyeButton: {
    padding: spacing.xs,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.md,
  },
});
