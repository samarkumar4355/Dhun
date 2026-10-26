// ─── Home / Listen Screen ───────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  FlatList,
  StyleSheet,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
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
import { api, formatBackendTrackToSong } from '@/services/api/apiClient';
import { offlineService } from '@/services/offlineService';
import { Song, Album, Artist, MoodSession } from '@/types/music';
import { getGreeting, getTimePhraseHindi, stringToColor, getInitials } from '@/utils/helpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ListenScreen() {
  const { colors, glass, isDark } = useTheme();
  const { currentSong, play } = usePlayer();
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const greeting = getGreeting();
  const timePhrase = getTimePhraseHindi();

  // State for real catalog items (No fabricated mock fixtures in production)
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [genres, setGenres] = useState<any[]>([]);
  const [recentTracks, setRecentTracks] = useState<Song[]>([]);
  const [likedCount, setLikedCount] = useState<number>(0);
  const [totalSongsCount, setTotalSongsCount] = useState<number>(0);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const firstName = user?.name ? user.name.split(' ')[0] : 'Listener';
  const initials = user?.name ? getInitials(user.name) : 'DL';

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [tracksRes, albumsRes, artistsRes, genresRes] = await Promise.all([
        api.getTracks({ limit: 50 }).catch(err => {
          throw err;
        }),
        api.getAlbums({ limit: 10 }).catch(() => null),
        api.getArtists({ limit: 10 }).catch(() => null),
        api.getGenres().catch(() => null),
      ]);

      if (tracksRes?.success && tracksRes.data) {
        const mapped = tracksRes.data.map(t =>
          formatBackendTrackToSong(t, false, offlineService.isDownloaded(t.id))
        );
        setRecentTracks(mapped);
        setTotalSongsCount(tracksRes.meta?.total || mapped.length);
      }

      if (genresRes?.success && genresRes.data) {
        setGenres(genresRes.data);
      }

      if (albumsRes?.success && albumsRes.data) {
        const mappedAlbums: Album[] = albumsRes.data.map(a => ({
          id: a.id || a._id || '',
          title: a.title,
          artistId: typeof a.artists?.[0] === 'object' ? (a.artists[0] as any).id : '',
          artistName: typeof a.artists?.[0] === 'object' ? (a.artists[0] as any).name : 'Various Artists',
          artwork: a.artworkUrl || null,
          year: a.releaseYear || 2026,
          songCount: a.tracks?.length || 1,
        }));
        setAlbums(mappedAlbums);
      }

      if (artistsRes?.success && artistsRes.data) {
        const mappedArtists: Artist[] = artistsRes.data.map(ar => ({
          id: ar.id || ar._id || '',
          name: ar.name,
          artwork: ar.artworkUrl || null,
          languages: ['Hindi', 'English'],
          genres: (ar.genres || []).map(g => (typeof g === 'object' ? (g as any).name : String(g))),
        }));
        setArtists(mappedArtists);
      }

      if (isAuthenticated) {
        const favsRes = await api.getFavorites(1, 1).catch(() => null);
        if (favsRes?.success && favsRes.meta?.total !== undefined) {
          setLikedCount(favsRes.meta.total);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Unable to load music from Dhun server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const moodSessions: MoodSession[] = useMemo(() => {
    const list: MoodSession[] = [];
    const moodTypes: MoodSession['moodType'][] = [
      'slow-morning',
      'midnight-drive',
      'rainy-evening',
      'deep-focus',
      'romance',
      'travel',
    ];

    genres.forEach((g: any, idx: number) => {
      const gName = g.name || 'Genre';
      const matchingSongIds = recentTracks
        .filter(t => (t as any).genre?.includes?.(gName) || t.artistName.toLowerCase().includes('woodward'))
        .map(t => t.id);

      list.push({
        id: g._id || g.id || `genre-${idx}`,
        title: gName,
        subtitle: gName === 'Pop-Folk' ? 'Acoustic & Melodic' : 'Driving Rhythms & Energy',
        description: `Lossless ${gName} songs streaming directly from your Google Drive library.`,
        artwork: null,
        moodType: moodTypes[idx % moodTypes.length],
        songIds: matchingSongIds,
      });
    });

    list.push({
      id: 'session-lossless',
      title: 'Lossless Hi-Res',
      subtitle: 'Bit-perfect 24-bit',
      description: 'Studio quality FLAC master recordings decoded bit-perfectly from Google Drive.',
      artwork: null,
      moodType: 'deep-focus',
      songIds: recentTracks.map(t => t.id),
    });

    return list;
  }, [genres, recentTracks]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: currentSong ? 120 : 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
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
            <View
              style={[
                styles.heroOverlay,
                { backgroundColor: isDark ? 'rgba(38, 50, 56, 0.75)' : 'rgba(235, 240, 242, 0.85)' },
              ]}
            >
              <View style={styles.heroContent}>
                <Text style={[typography.h2, { color: colors.textPrimary }]}>Dhun Moments</Text>
                <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
                  Curated emotional soundscapes for your state of mind
                </Text>
                <View style={[styles.exploreButton, { backgroundColor: colors.accent }]}>
                  <Text style={[typography.label, { color: '#1A1714' }]}>Explore</Text>
                </View>
              </View>
            </View>
          </GlassSurface>
        </AnimatedBorder>

        {/* Loading Indicator */}
        {loading && totalSongsCount === 0 && (
          <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        )}

        {/* Error State with Retry */}
        {error && (
          <GlassSurface
            variant="card"
            style={styles.errorCard}
            borderRadius={radius.lg}
          >
            <Ionicons name="alert-circle-outline" size={24} color={colors.accent} />
            <Text style={[typography.body, { color: colors.textPrimary, marginLeft: spacing.md, flex: 1 }]}>
              {error}
            </Text>
            <Pressable onPress={loadData} style={[styles.retryButton, { backgroundColor: colors.accent }]}>
              <Text style={[typography.label, { color: '#1A1714' }]}>Retry</Text>
            </Pressable>
          </GlassSurface>
        )}

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

        {/* Your Music Quick Access */}
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
              <Text style={[typography.label, { color: colors.textPrimary }]}>Catalog</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{totalSongsCount} songs</Text>
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
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{likedCount} songs</Text>
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
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{albums.length} albums</Text>
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
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{artists.length} artists</Text>
            </View>
          </GlassSurface>
        </View>

        {/* Recently Added Albums (Touch-Enabled Horizontal Carousel) */}
        <SectionHeader title="Recently Added" onSeeAll={() => router.push('/(tabs)/library')} />
        <FlatList
          data={albums}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg }}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <AlbumCard
              title={item.title}
              artistName={item.artistName}
              artwork={item.artwork}
              onPress={() => {
                const matched = recentTracks.find(s => s.albumId === item.id) || recentTracks[0];
                if (matched) play(matched, recentTracks);
              }}
            />
          )}
          nestedScrollEnabled={true}
          style={{ overflow: 'visible' }}
        />

        {/* Featured Artists (Touch-Enabled Horizontal Carousel) */}
        <SectionHeader title="Featured Artists" onSeeAll={() => router.push('/artists')} />
        <FlatList
          data={artists}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <ArtistCard
              name={item.name}
              artwork={item.artwork}
              size={80}
              showBorderRing={true}
              onPress={() =>
                router.push({
                  pathname: '/artists',
                  params: { id: item.id, search: item.name },
                })
              }
            />
          )}
          nestedScrollEnabled={true}
          style={{ overflow: 'visible' }}
        />

        {/* Songs from Google Drive */}
        {recentTracks.length > 0 && (
          <>
            <SectionHeader title="Google Drive Songs" onSeeAll={() => router.push('/(tabs)/library')} />
            {recentTracks.map(song => (
              <SongRow
                key={song.id}
                song={song}
                onPress={() => play(song, recentTracks)}
                isActive={currentSong?.id === song.id}
              />
            ))}
          </>
        )}

        {/* Mood & Genre Sessions */}
        <SectionHeader title="Mood Sessions" onSeeAll={() => router.push('/moments')} />
        <FlatList
          data={moodSessions}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg }}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <MoodCard
              mood={item}
              onPress={() =>
                router.push({
                  pathname: '/moments',
                  params: { genreId: item.id, genreName: item.title },
                })
              }
            />
          )}
          nestedScrollEnabled={true}
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
          {['Lossless Hi-Res', 'Offline Library', 'Personal Collection'].map(filter => (
            <GlassSurface
              key={filter}
              variant="subtle"
              borderRadius={radius.full}
              onPress={() => router.push('/(tabs)/library')}
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
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  retryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
});
