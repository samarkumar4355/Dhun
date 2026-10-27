// ─── Dhun Reset Password Modal ─────────────────────────────────────────
// Multi-step modal for requesting a password reset token and setting
// a new password with musical password generation support.

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { GlassSurface } from '@/components/GlassSurface';
import { api } from '@/services/api/apiClient';
import { generateDhunPassword } from '@/services/AuthProvider';

interface ResetPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  initialEmail?: string;
  onSuccess: (data: { email: string; newPassword: string }) => void;
}

export function ResetPasswordModal({
  visible,
  onClose,
  initialEmail = '',
  onSuccess,
}: ResetPasswordModalProps) {
  const { colors, glass } = useTheme();

  const [step, setStep] = useState<'request' | 'reset' | 'success'>('request');
  const [email, setEmail] = useState(initialEmail);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync initialEmail when opened
  React.useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail, visible]);

  const handleRequestToken = async () => {
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.forgotPassword(cleanEmail);
      if (res?.data?.resetToken) {
        setResetToken(res.data.resetToken);
        setStep('reset');
      } else {
        setError(res?.data?.message || 'Password reset request generated. Please check your token.');
        setStep('reset');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to request password reset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError(null);
    if (!resetToken.trim()) {
      setError('Reset token is required.');
      return;
    }
    if (!newPassword.trim() || newPassword.trim().length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    try {
      setLoading(true);
      await api.resetPassword(resetToken, newPassword);
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please verify the reset token.');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePassword = () => {
    const generated = generateDhunPassword();
    setNewPassword(generated);
    setShowPassword(true);
  };

  const handleFinish = () => {
    onSuccess({ email: email.trim().toLowerCase(), newPassword: newPassword.trim() });
    setStep('request');
    setError(null);
    onClose();
  };

  const handleClose = () => {
    setStep('request');
    setError(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={step === 'reset' ? undefined : handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >

        <GlassSurface
          variant="elevated"
          borderRadius={radius['2xl']}
          showTopHighlight
          style={[
            styles.card,
            {
              backgroundColor: 'rgba(18, 12, 26, 0.98)',
              borderColor: 'rgba(229, 184, 66, 0.35)',
              borderWidth: 1,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.h3, { color: colors.accentWarm || '#FFD700' }]}>
                {step === 'request' && 'Reset Password'}
                {step === 'reset' && 'Set New Password'}
                {step === 'success' && 'Password Updated!'}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                {step === 'request' && 'Enter your registered email to receive a reset token.'}
                {step === 'reset' && 'Create your new secure musical password.'}
                {step === 'success' && 'You can now log in with your updated credentials.'}
              </Text>
            </View>
            <Pressable
              onPress={handleClose}
              hitSlop={12}
              style={[styles.closeBtn, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Error Banner */}
          {error && (
            <View style={[styles.errorBanner, { backgroundColor: 'rgba(224, 97, 74, 0.15)', borderColor: colors.error }]}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={[typography.caption, { color: colors.error, marginLeft: spacing.xs, flex: 1 }]}>
                {error}
              </Text>
            </View>
          )}

          {/* Step 1: Request Token */}
          {step === 'request' && (
            <View style={styles.body}>
              <Text style={[typography.label, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
                Registered Email Address
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[
                  styles.input,
                  {
                    backgroundColor: glass.surfaceSubtle,
                    borderColor: glass.border,
                    color: colors.textPrimary,
                  },
                ]}
              />

              <Pressable
                onPress={handleRequestToken}
                disabled={loading}
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.accentWarm || '#FFD700', marginTop: spacing.lg },
                ]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#09080E" />
                ) : (
                  <Text style={[typography.label, { color: '#09080E', fontWeight: '700' }]}>
                    Send Reset Request
                  </Text>
                )}
              </Pressable>
            </View>
          )}

          {/* Step 2: Enter New Password */}
          {step === 'reset' && (
            <View style={styles.body}>
              <View style={[styles.tokenNotice, { backgroundColor: 'rgba(229, 184, 66, 0.10)', borderColor: 'rgba(229, 184, 66, 0.30)' }]}>
                <Ionicons name="key" size={16} color={colors.accentWarm || '#FFD700'} />
                <Text style={[typography.caption, { color: colors.accentWarm || '#FFD700', marginLeft: spacing.xs, flex: 1 }]}>
                  Reset token auto-loaded for {email}
                </Text>
              </View>

              <Text style={[typography.label, { color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.xs }]}>
                Reset Token
              </Text>
              <TextInput
                value={resetToken}
                onChangeText={setResetToken}
                placeholder="Paste reset token here"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                style={[
                  styles.input,
                  {
                    backgroundColor: glass.surfaceSubtle,
                    borderColor: glass.border,
                    color: colors.textPrimary,
                  },
                ]}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.xs }}>
                <Text style={[typography.label, { color: colors.textPrimary }]}>
                  New Password
                </Text>
                <Pressable onPress={handleGeneratePassword} hitSlop={8}>
                  <Text style={[typography.caption, { color: colors.accentWarm || '#FFD700', fontWeight: '600' }]}>
                    ✨ Generate Musical
                  </Text>
                </Pressable>
              </View>

              <View style={styles.passwordInputWrapper}>
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter or generate new password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  style={[
                    styles.input,
                    styles.passwordInput,
                    {
                      backgroundColor: glass.surfaceSubtle,
                      borderColor: glass.border,
                      color: colors.textPrimary,
                    },
                  ]}
                />
                <Pressable
                  onPress={() => setShowPassword((p) => !p)}
                  hitSlop={8}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>

              <Pressable
                onPress={handleResetPassword}
                disabled={loading}
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.accentWarm || '#FFD700', marginTop: spacing.lg },
                ]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#09080E" />
                ) : (
                  <Text style={[typography.label, { color: '#09080E', fontWeight: '700' }]}>
                    Confirm & Update Password
                  </Text>
                )}
              </Pressable>
            </View>
          )}

          {/* Step 3: Success Screen */}
          {step === 'success' && (
            <View style={[styles.body, { alignItems: 'center', paddingVertical: spacing.lg }]}>
              <View style={[styles.successCircle, { backgroundColor: 'rgba(52, 168, 83, 0.15)', borderColor: '#34A853' }]}>
                <Ionicons name="checkmark-circle" size={48} color="#34A853" />
              </View>
              <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' }]}>
                Password Reset Successfully!
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}>
                Your new password has been set. Click below to return and sign in.
              </Text>

              <Pressable
                onPress={handleFinish}
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.accentWarm || '#FFD700', marginTop: spacing.xl, width: '100%' },
                ]}
              >
                <Text style={[typography.label, { color: '#09080E', fontWeight: '700' }]}>
                  Continue to Log In
                </Text>
              </Pressable>
            </View>
          )}
        </GlassSurface>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    padding: spacing.xl,
    borderRadius: radius['2xl'],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  body: {
    marginTop: spacing.xs,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 14,
  },
  passwordInputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
  },
  tokenNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  actionButton: {
    height: 48,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
});
