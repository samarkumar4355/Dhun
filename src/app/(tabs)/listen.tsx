// ─── Home / Listen Screen ───────────────────────────────────────────

import React from 'react';
import { View, Text, ScrollView, Pressable, FlatList, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { usePlayer } from '@/services/PlayerProvider';
import { useAuth } from '@/services/AuthProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { SectionHeader } from '@/components/SectionHeader';
import { AlbumCard } from '@/components/AlbumCard';
import { ArtistCard } from '@/components/ArtistCard';
import { SongRow } from '@/components/SongRow';
import { MoodCard } from '@/components/MoodCard';
import { MiniPlayer } from '@/components/MiniPlayer';
import { GlassSurface } from '@/components/GlassSurface';
import { AnimatedBorder } from '@/components/AnimatedBorder';
import { mockSongs } from '@/data/mockSongs';
import { mockAlbums } from '@/data/mockAlbums';
import { mockArtists } from '@/data/mockArtists';
import { mockMoments } from '@/data/mockMoments';
import { getGreeting, getTimePhraseHindi, stringToColor, getInitials } from '@/utils/helpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ListenScreen() {
  const { colors, glass, isDark } = useTheme();
  const { currentSong, play } = usePlayer();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const greeting = getGreeting();
  const timePhrase = getTimePhraseHindi();
  const recentSongs = mockSongs.slice(0, 3);
  const likedSongs = mockSongs.filter(s => s.isFavorite);

  const firstName = user?.name ? user.name.split(' ')[0] : 'Listener';
  const initials = user?.name ? getInitials(user.name) : 'DL';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: currentSong ? 120 : 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
          <View>
            <Text style={[styles.brandName, { color: colors.textPrimary }]}>Dhun</Text>
            <Text style={[typography.bodyLarge, { color: colors.textSecondary, marginTop: 2 }]}>
              {greeting}, {firstName}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              onPress={() => router.push('/search')}
              hitSlop={8}
              accessibilityLabel="Search"
              style={{ marginRight: spacing.lg }}
            >
              <Ionicons name="search" size={22} color={colors.textPrimary} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityLabel="Profile"
            >
              <View style={[styles.avatar, { backgroundColor: stringToColor(user?.name || 'Dhun') }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Dhun Moments Hero Banner with travelling border highlight */}
        <AnimatedBorder
          id="hero_moments"
          borderRadius={radius.xl}
          style={styles.heroBorderWrapper}
          active
          duration={7}
          strokeWidth={1.5}
        >
          <GlassSurface
            variant="card"
            borderRadius={radius.xl}
            showTopHighlight
            showAmbientGlow
            onPress={() => router.push('/moments')}
            style={styles.heroBanner}
          >
            <View style={[styles.heroOverlay, { backgroundColor: isDark ? 'rgba(38, 50, 56, 0.75)' : 'rgba(235, 240, 242, 0.85)' }]}>
              <View style={styles.heroContent}>
                <Text style={[typography.h2, { color: colors.textPrimary }]}>Dhun Moments</Text>
                <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
                  Curated from your personal collection
                </Text>
                <View style={[styles.exploreButton, { backgroundColor: colors.accent }]}>
                  <Text style={[typography.label, { color: '#1A1714' }]}>Explore</Text>
                </View>
              </View>
            </View>
          </GlassSurface>
        </AnimatedBorder>

        {/* Continue Listening */}
        {currentSong && (
          <>
            <SectionHeader title="Continue Listening" showSeeAll={false} />
            <SongRow
              song={currentSong}
              onPress={() => router.push('/player')}
              isActive
            />
          </>
        )}

        {/* Your Music */}
        <SectionHeader title="Your Music" showSeeAll={false} />
        <View style={styles.quickCards}>
          <GlassSurface
            variant="card"
            style={styles.quickCard}
            onPress={() => router.push('/(tabs)/library')}
            showTopHighlight
          >
            <Ionicons name="musical-notes" size={22} color={colors.accent} />
            <View style={styles.quickCardText}>
              <Text style={[typography.label, { color: colors.textPrimary }]}>Recently Added</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>342 songs</Text>
            </View>
          </GlassSurface>
          <GlassSurface
            variant="card"
            style={styles.quickCard}
            onPress={() => router.push('/(tabs)/library')}
            showTopHighlight
          >
            <Ionicons name="heart" size={22} color={colors.accent} />
            <View style={styles.quickCardText}>
              <Text style={[typography.label, { color: colors.textPrimary }]}>Liked Songs</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{likedSongs.length} songs</Text>
            </View>
          </GlassSurface>
        </View>
        <View style={styles.quickCards}>
          <GlassSurface
            variant="card"
            style={styles.quickCard}
            onPress={() => router.push('/(tabs)/library')}
            showTopHighlight
          >
            <Ionicons name="disc" size={22} color={colors.accent} />
            <View style={styles.quickCardText}>
              <Text style={[typography.label, { color: colors.textPrimary }]}>Albums</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{mockAlbums.length} albums</Text>
            </View>
          </GlassSurface>
          <GlassSurface
            variant="card"
            style={styles.quickCard}
            onPress={() => router.push('/artists')}
            showTopHighlight
          >
            <Ionicons name="people" size={22} color={colors.accent} />
            <View style={styles.quickCardText}>
              <Text style={[typography.label, { color: colors.textPrimary }]}>Artists</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{mockArtists.length} artists</Text>
            </View>
          </GlassSurface>
        </View>

        {/* Recently Added */}
        <SectionHeader title="Recently Added" onSeeAll={() => router.push('/(tabs)/library')} />
        <FlatList
          data={mockAlbums.slice(0, 5)}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg }}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <AlbumCard
              title={item.title}
              artistName={item.artistName}
              artwork={item.artwork}
              onPress={() => play(mockSongs.find(s => s.albumId === item.id) || mockSongs[0])}
            />
          )}
          scrollEnabled={false}
          style={{ overflow: 'visible' }}
        />

        {/* Featured Artists */}
        <SectionHeader title="Featured Artists" onSeeAll={() => router.push('/artists')} />
        <FlatList
          data={mockArtists.slice(0, 5)}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <ArtistCard
              name={item.name}
              artwork={null}
              size={80}
              showBorderRing={true}
              onPress={() => router.push('/artists')}
            />
          )}
          scrollEnabled={false}
          style={{ overflow: 'visible' }}
        />

        {/* Mood Sessions */}
        <SectionHeader title="Mood Sessions" onSeeAll={() => router.push('/moments')} />
        <FlatList
          data={mockMoments.slice(0, 5)}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg }}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <MoodCard mood={item} onPress={() => router.push('/moments')} />
          )}
          scrollEnabled={false}
          style={{ overflow: 'visible' }}
        />

        {/* Indian phrase */}
        <View style={styles.phraseContainer}>
          <Text style={[styles.phrase, { color: colors.textMuted }]}>
            {timePhrase}
          </Text>
        </View>

        {/* Quick filters */}
        <View style={styles.filterRow}>
          {['Lossless', 'Offline', 'Yours'].map(filter => (
            <GlassSurface
              key={filter}
              variant="subtle"
              borderRadius={radius.full}
              style={styles.filterChip}
            >
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{filter}</Text>
            </GlassSurface>
          ))}
        </View>
      </ScrollView>

      {/* Mini Player */}
      {currentSong && (
        <View style={styles.miniPlayerContainer}>
          <MiniPlayer />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  heroBorderWrapper: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  heroBanner: {
    overflow: 'hidden',
  },
  heroOverlay: {
    padding: spacing['2xl'],
    minHeight: 160,
    justifyContent: 'flex-end',
  },
  heroContent: {},
  exploreButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    marginTop: spacing.md,
  },
  quickCards: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  quickCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  quickCardText: {
    flex: 1,
  },
  phraseContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
  },
  phrase: {
    fontSize: 13,
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing['2xl'],
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  miniPlayerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
