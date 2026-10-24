// ─── Import Progress Screen ─────────────────────────────────────────

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { formatFileSize } from '@/utils/helpers';
import { mockImportJobs } from '@/services/mockImportService';
import { ImportJob } from '@/types/music';

export default function ImportProgressScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [jobs, setJobs] = useState<ImportJob[]>(mockImportJobs);

  const activeJob = jobs.find(j => j.status === 'importing' && j.processedFiles > 0);
  const totalProgress = activeJob
    ? Math.round((activeJob.processedFiles / activeJob.totalFiles) * 100)
    : 0;

  const handleCancel = () => {
    Alert.alert(
      'Cancel Import',
      'Are you sure you want to cancel the current import? Progress will be lost.',
      [
        { text: 'Keep Importing', style: 'cancel' },
        {
          text: 'Cancel Import',
          style: 'destructive',
          onPress: () => {
            setJobs(prev =>
              prev.map(j =>
                j.status === 'importing' ? { ...j, status: 'cancelled' as const } : j
              )
            );
          },
        },
      ]
    );
  };

  const handleRetry = (jobId: string) => {
    setJobs(prev =>
      prev.map(j =>
        j.id === jobId ? { ...j, status: 'importing' as const, failedFiles: 0 } : j
      )
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={[typography.h3, { color: colors.textPrimary, marginLeft: spacing.lg, flex: 1 }]}>
            Importing Music
          </Text>
        </View>

        {/* Main progress card */}
        {activeJob && (
          <View style={[styles.mainCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.mainCardHeader}>
              <Ionicons name="document" size={20} color={colors.accent} />
              <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '600', marginLeft: spacing.sm, flex: 1 }]}>
                {activeJob.sourceName}
              </Text>
              <Text style={[typography.label, { color: colors.accent }]}>
                {totalProgress}%
              </Text>
            </View>

            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>
              {activeJob.processedFiles} / {activeJob.totalFiles} files
            </Text>

            {/* Progress bar */}
            <View style={[styles.progressTrack, { backgroundColor: colors.progressTrack }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.progressFill, width: `${totalProgress}%` },
                ]}
              />
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Estimated size</Text>
                <Text style={[typography.label, { color: colors.textPrimary }]}>
                  {formatFileSize(activeJob.estimatedSize)}
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Formats found</Text>
                <Text style={[typography.label, { color: colors.textPrimary }]}>
                  {activeJob.formats.join(', ')}
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Time remaining</Text>
                <Text style={[typography.label, { color: colors.textPrimary }]}>~12 min</Text>
              </View>
            </View>
          </View>
        )}

        {/* Job list */}
        <View style={styles.jobListHeader}>
          <Text style={[typography.label, { color: colors.textSecondary }]}>
            Importing...
          </Text>
        </View>

        {jobs.map(job => (
          <JobRow
            key={job.id}
            job={job}
            colors={colors}
            onRetry={() => handleRetry(job.id)}
          />
        ))}

        {/* Cancel button */}
        {jobs.some(j => j.status === 'importing') && (
          <Pressable
            onPress={handleCancel}
            style={[styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.error }]}
          >
            <Text style={[typography.label, { color: colors.error }]}>Cancel Import</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function JobRow({
  job,
  colors,
  onRetry,
}: {
  job: ImportJob;
  colors: ReturnType<typeof useTheme>['colors'];
  onRetry: () => void;
}) {
  const statusIcon = (() => {
    switch (job.status) {
      case 'completed': return { name: 'checkmark-circle' as const, color: colors.success };
      case 'failed': return { name: 'alert-circle' as const, color: colors.error };
      case 'importing': return { name: 'sync' as const, color: colors.accent };
      case 'pending': return { name: 'time' as const, color: colors.textMuted };
      case 'cancelled': return { name: 'close-circle' as const, color: colors.textMuted };
    }
  })();

  return (
    <View style={[styles.jobRow, { borderBottomColor: colors.borderSubtle }]}>
      <View style={{ flex: 1 }}>
        <View style={styles.jobNameRow}>
          <Text style={[typography.body, { color: colors.textPrimary }]}>{job.sourceName}</Text>
          <Ionicons name={statusIcon.name} size={18} color={statusIcon.color} />
        </View>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
          {job.processedFiles} / {job.totalFiles}
        </Text>
        {job.status === 'importing' && (
          <View style={[styles.jobProgress, { backgroundColor: colors.progressTrack }]}>
            <View
              style={[
                styles.jobProgressFill,
                {
                  backgroundColor: colors.progressFill,
                  width: `${(job.processedFiles / job.totalFiles) * 100}%`,
                },
              ]}
            />
          </View>
        )}
      </View>

      {job.status === 'failed' && (
        <Pressable onPress={onRetry} hitSlop={8} style={{ marginLeft: spacing.md }}>
          <Ionicons name="refresh" size={20} color={colors.accent} />
        </Pressable>
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
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  mainCard: {
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    marginBottom: spacing.xl,
  },
  mainCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  stat: {
    alignItems: 'center',
  },
  jobListHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
  },
  jobNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  jobProgress: {
    height: 3,
    borderRadius: 1.5,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  jobProgressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  cancelButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing['2xl'],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
});
