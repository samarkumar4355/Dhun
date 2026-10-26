// ─── About Dhun Screen ─────────────────────────────────────────────

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { DhunWordmark } from '@/components/DhunWordmark';
import { GlassSurface } from '@/components/GlassSurface';
import { safeBack } from '@/utils/helpers';

export default function AboutScreen() {
  const { colors, glass, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable
            onPress={() => safeBack(router, '/settings')}
            hitSlop={12}
            accessibilityLabel="Go back"
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={[typography.h2, { color: colors.textPrimary, marginLeft: spacing.lg }]}>
            About Dhun
          </Text>
        </View>

        {/* Brand Banner */}
        <View style={styles.brandContainer}>
          <DhunWordmark size="large" />
          <Text style={[typography.label, { color: colors.accent, marginTop: spacing.md, letterSpacing: 2 }]}>
            VERSION 1.0.0
          </Text>
          <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.sm, textAlign: 'center' }]}>
            Your Music, Untouched.
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.xl }]}>
            A premium music platform engineered for uncompromised lossless audio, reliable offline listening, and rich music discovery.
          </Text>
        </View>

        {/* Core Principles */}
        <GlassSurface
          variant="card"
          borderRadius={radius.lg}
          showTopHighlight
          style={styles.infoCard}
        >
          <Text style={[typography.label, { color: colors.accent, marginBottom: spacing.md }]}>
            CORE ARCHITECTURE
          </Text>

          <FeatureRow
            icon="shield-checkmark"
            title="Bit-Perfect Audio Integrity"
            description="Preserves source FLAC, ALAC, and MP3 files identically. Zero lossy transcoding or compression."
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: glass.border }]} />

          <FeatureRow
            icon="cloud-offline"
            title="Lossless Offline Sync"
            description="Download authorized master tracks with SHA-256 and MD5 checksum verification for offline playback."
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: glass.border }]} />

          <FeatureRow
            icon="musical-note"
            title="Connected Catalog & Lyrics"
            description="Relational artist, album, and genre graph with complete verse-accurate lyrics and audio quality metrics."
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: glass.border }]} />

          <FeatureRow
            icon="radio"
            title="HTTP Range Streaming"
            description="RFC 7233 partial content audio streaming for instant seeking, scrubbing, and pause/resume with zero memory overhead."
            colors={colors}
            isLast
          />
        </GlassSurface>

        {/* Audio Quality Specification */}
        <GlassSurface
          variant="card"
          borderRadius={radius.lg}
          showTopHighlight
          style={styles.infoCard}
        >
          <Text style={[typography.label, { color: colors.accent, marginBottom: spacing.md }]}>
            TECHNICAL SPECIFICATIONS
          </Text>
          <SpecRow label="Master Formats" value="FLAC, ALAC, WAV, MP3" colors={colors} />
          <SpecRow label="Max Bit Depth" value="24-bit Hi-Res Audio" colors={colors} />
          <SpecRow label="Max Sample Rate" value="192 kHz Lossless" colors={colors} />
          <SpecRow label="Streaming Protocol" value="HTTP 1.1 / 2 Range (206)" colors={colors} />
          <SpecRow label="Catalog Engine" value="MongoDB Atlas & Node.js" colors={colors} />
          <SpecRow label="Mobile Framework" value="Expo Router & React Native" colors={colors} isLast />
        </GlassSurface>

        {/* Legal & Attribution */}
        <GlassSurface
          variant="subtle"
          borderRadius={radius.lg}
          style={styles.infoCard}
        >
          <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
            MUSIC LICENSING & ATTRIBUTION
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, lineHeight: 18 }]}>
            Test tracks provided under legal Creative Commons / Artist-Authorized distribution by Josh Woodward (joshwoodward.com). Dhun respects artist copyright and intellectual property.
          </Text>
        </GlassSurface>
      </ScrollView>
    </View>
  );
}

function FeatureRow({
  icon,
  title,
  description,
  colors,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  colors: any;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.featureRow, !isLast && { marginBottom: spacing.md }]}>
      <View style={[styles.featureIcon, { backgroundColor: 'rgba(215, 166, 90, 0.12)' }]}>
        <Ionicons name={icon} size={20} color={colors.accent} />
      </View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={[typography.label, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2, lineHeight: 17 }]}>
          {description}
        </Text>
      </View>
    </View>
  );
}

function SpecRow({
  label,
  value,
  colors,
  isLast = false,
}: {
  label: string;
  value: string;
  colors: any;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.specRow, !isLast && { marginBottom: spacing.sm }]}>
      <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typography.bodySmall, { color: colors.textPrimary, fontWeight: '600' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  backButton: {
    padding: 4,
  },
  brandContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  infoCard: {
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  divider: {
    height: 0.5,
    marginVertical: spacing.md,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
