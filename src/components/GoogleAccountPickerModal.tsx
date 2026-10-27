// ─── Google Account Picker Modal ──────────────────────────────────────
// Displays an authentic Google Account Chooser bottom sheet so the user
// can select an existing account or enter another Google email to sign in.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { GlassSurface } from '@/components/GlassSurface';
import { GoogleIcon } from '@/components/GoogleIcon';
import { storage } from '@/utils/storage';

const SAVED_GOOGLE_ACCOUNTS_KEY = 'dhun_saved_google_accounts';

export interface GoogleAccount {
  email: string;
  displayName: string;
  avatarUrl?: string;
}

const DEFAULT_ACCOUNTS: GoogleAccount[] = [
  {
    email: 'samarkumar4355@gmail.com',
    displayName: 'Samar Kumar',
  },
  {
    email: 'arjun@email.com',
    displayName: 'Arjun Sharma',
  },
];

interface GoogleAccountPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAccount: (account: GoogleAccount) => void;
  loading?: boolean;
}

export function GoogleAccountPickerModal({
  visible,
  onClose,
  onSelectAccount,
  loading = false,
}: GoogleAccountPickerModalProps) {
  const { colors, glass, isDark } = useTheme();

  const [accounts, setAccounts] = useState<GoogleAccount[]>(DEFAULT_ACCOUNTS);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Load saved accounts from storage on mount
  useEffect(() => {
    try {
      const raw = storage.getItem(SAVED_GOOGLE_ACCOUNTS_KEY);
      if (raw) {
        const parsed: GoogleAccount[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge with defaults avoiding duplicates
          const map = new Map<string, GoogleAccount>();
          DEFAULT_ACCOUNTS.forEach((acc) => map.set(acc.email.toLowerCase(), acc));
          parsed.forEach((acc) => map.set(acc.email.toLowerCase(), acc));
          setAccounts(Array.from(map.values()));
        }
      }
    } catch {
      // Keep defaults
    }
  }, [visible]);

  const saveAndSelectAccount = (account: GoogleAccount) => {
    try {
      const updated = [
        account,
        ...accounts.filter((a) => a.email.toLowerCase() !== account.email.toLowerCase()),
      ];
      setAccounts(updated);
      storage.setItem(SAVED_GOOGLE_ACCOUNTS_KEY, JSON.stringify(updated.slice(0, 5)));
    } catch {
      // Ignore storage errors
    }
    onSelectAccount(account);
  };

  const handleAddNewAccount = () => {
    setFormError(null);
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFormError('Please enter a valid Google email address.');
      return;
    }
    const cleanName = newName.trim() || cleanEmail.split('@')[0];
    const newAcc: GoogleAccount = {
      email: cleanEmail,
      displayName: cleanName,
    };
    saveAndSelectAccount(newAcc);
  };

  const getInitial = (name: string, email: string) => {
    if (name && name.trim()) return name.trim().charAt(0).toUpperCase();
    return email.charAt(0).toUpperCase();
  };

  // Google avatar color rotation
  const getAvatarColor = (index: number) => {
    const palette = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#9C27B0'];
    return palette[index % palette.length];
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        
        <GlassSurface
          variant="elevated"
          borderRadius={radius['2xl']}
          showTopHighlight
          style={[
            styles.sheetCard,
            {
              backgroundColor: 'rgba(16, 11, 24, 0.97)',
              borderColor: 'rgba(229, 184, 66, 0.35)',
              borderWidth: 1,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.googleBrandRow}>
              <GoogleIcon size={24} />
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={[typography.h3, { color: colors.textPrimary }]}>
                  Sign in with Google
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  Choose an account to continue to Dhun
                </Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={[styles.closeBtn, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.divider} />

          {/* Accounts List */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollList}
          >
            {accounts.map((item, index) => (
              <Pressable
                key={`account-${item.email}`}
                onPress={() => saveAndSelectAccount(item)}
                disabled={loading}
                style={({ pressed }) => [
                  styles.accountRow,
                  {
                    backgroundColor: pressed ? 'rgba(229, 184, 66, 0.12)' : 'transparent',
                    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
                  },
                ]}
              >
                <View
                  style={[
                    styles.avatarCircle,
                    { backgroundColor: getAvatarColor(index) },
                  ]}
                >
                  <Text style={styles.avatarInitial}>
                    {getInitial(item.displayName, item.email)}
                  </Text>
                </View>
                <View style={styles.accountInfo}>
                  <Text style={[typography.label, { color: colors.textPrimary }]} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
                    {item.email}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}

            {/* Add / Use another account toggle */}
            {!showAddForm ? (
              <Pressable
                onPress={() => setShowAddForm(true)}
                style={({ pressed }) => [
                  styles.addAccountBtn,
                  {
                    backgroundColor: pressed ? 'rgba(229, 184, 66, 0.08)' : 'transparent',
                  },
                ]}
              >
                <View style={[styles.avatarCircle, { backgroundColor: 'rgba(229, 184, 66, 0.15)' }]}>
                  <Ionicons name="person-add" size={18} color={colors.accentWarm || '#FFD700'} />
                </View>
                <Text style={[typography.label, { color: colors.accentWarm || '#FFD700', marginLeft: spacing.md }]}>
                  Use another account
                </Text>
              </Pressable>
            ) : (
              <View style={[styles.addFormCard, { backgroundColor: 'rgba(255, 255, 255, 0.04)', borderColor: glass.border }]}>
                <Text style={[typography.label, { color: colors.accentWarm || '#FFD700', marginBottom: spacing.sm }]}>
                  Enter Google Account Details
                </Text>

                {formError && (
                  <Text style={[typography.caption, { color: colors.error, marginBottom: spacing.xs }]}>
                    {formError}
                  </Text>
                )}

                <TextInput
                  value={newEmail}
                  onChangeText={setNewEmail}
                  placeholder="Google Email (e.g. user@gmail.com)"
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

                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Your Name (optional)"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  style={[
                    styles.input,
                    {
                      backgroundColor: glass.surfaceSubtle,
                      borderColor: glass.border,
                      color: colors.textPrimary,
                      marginTop: spacing.sm,
                    },
                  ]}
                />

                <View style={styles.formBtnRow}>
                  <Pressable
                    onPress={() => setShowAddForm(false)}
                    style={[styles.cancelFormBtn, { borderColor: glass.border }]}
                  >
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleAddNewAccount}
                    style={[styles.submitFormBtn, { backgroundColor: colors.accentWarm || '#FFD700' }]}
                  >
                    <Text style={[typography.label, { color: '#09080E', fontWeight: '700' }]}>
                      Sign In
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="small" color={colors.accentWarm || '#FFD700'} />
                <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: spacing.sm }]}>
                  Connecting to Google...
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer note */}
          <Text style={[typography.caption, styles.footerNote, { color: colors.textMuted }]}>
            To continue, Google will share your name and email address with Dhun.
          </Text>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    maxHeight: '80%',
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['2xl'],
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  googleBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: spacing.xs,
  },
  scrollList: {
    paddingVertical: spacing.xs,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderRadius: radius.md,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  accountInfo: {
    flex: 1,
  },
  addAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
    borderRadius: radius.md,
  },
  addFormCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 14,
  },
  formBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  cancelFormBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  submitFormBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  loadingOverlay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  footerNote: {
    textAlign: 'center',
    marginTop: spacing.md,
    fontSize: 11,
    lineHeight: 16,
  },
});
