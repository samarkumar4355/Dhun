// ─── Dhun Utilities ─────────────────────────────────────────────────

/** Format seconds to mm:ss */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Format bytes to human-readable size */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Format sample rate to kHz */
export function formatSampleRate(hz: number): string {
  return `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)} kHz`;
}

/** Get time-appropriate greeting */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good night';
}

/** Get time-appropriate Indian phrase */
export function getTimePhraseHindi(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'Subah ki taazeeh dhun.';
  if (hour >= 11 && hour < 17) return 'Aaj Ka Mood, Aaj Ki Dhun.';
  if (hour >= 17 && hour < 20) return 'Shaam ki surili baatein.';
  return 'Raat, Sukoon aur Dhun.';
}

/** Generate a color from a string (for placeholder avatars) */
export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 40%, 45%)`;
}

/** Get initials from a name */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}
