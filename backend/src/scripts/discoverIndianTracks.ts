import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { catalogService } from '../services/catalog.service.js';

export interface DiscoveredTrack {
  id: string; // unique identifier
  sourceItem: string;
  sourceFile: string;
  sourceUrl: string;
  title: string;
  artist: string;
  album: string;
  year?: number;
  language: string;
  genre: string[];
  durationEstimate?: number;
  fileSizeBytes?: number;
  artworkUrl?: string;
  format: string;
}

// Clean titles and remove track numbers, extensions, and tags
function cleanTitle(raw: string): string {
  let s = raw
    .replace(/\.[a-zA-Z0-9]+$/, '') // remove extension
    .replace(/^(\d+[\s._-]+)+/, '') // remove leading track numbers like "01 - ", "02. "
    .replace(/@\s*[\w.]+/gi, '') // remove website watermarks like "@ Mp3HunGama.Com"
    .replace(/\s*\(?(?:320kbps|128kbps|mp3|remix|audio|original)\)?/gi, '')
    .trim();

  // If title has "- FilmName", take the first part as title
  if (s.includes(' - ')) {
    const parts = s.split(' - ');
    if (parts.length >= 2 && parts[0].length > 2) {
      s = parts[0].trim();
    }
  }

  // Convert ALL CAPS or all lowercase to Title Case
  if (s === s.toUpperCase() || s === s.toLowerCase()) {
    s = s
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  return s.trim();
}

function cleanArtist(raw: string, fallback: string): string {
  if (!raw || raw.toLowerCase() === 'undefined' || raw.toLowerCase().includes('http') || raw.toLowerCase().includes('.com') || raw.toLowerCase().includes('artist')) {
    return fallback;
  }
  let s = raw.replace(/@\s*[\w.]+/gi, '').trim();
  if (s === s.toUpperCase() && s.length > 3) {
    s = s
      .toLowerCase()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return s || fallback;
}

function cleanAlbum(raw?: string, fallback = 'Bollywood Classics'): string {
  if (!raw || raw.toLowerCase() === 'undefined' || raw.toLowerCase().includes('.com') || raw.length < 2) {
    return fallback;
  }
  let s = raw.replace(/@\s*[\w.]+/gi, '').replace(/\(\d{4}\)/g, '').trim();
  if (s === s.toUpperCase() && s.length > 3) {
    s = s
      .toLowerCase()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return s || fallback;
}

export async function discoverAllIndianTracks(targetCount = 995): Promise<DiscoveredTrack[]> {
  console.log('🔍 Starting discovery of Indian & Hindi tracks from open web archives...');

  const manifestPath = path.join(env.localImportFolder, 'import-manifest.json');
  const existingSet = new Set<string>();
  if (fs.existsSync(manifestPath)) {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const existing = JSON.parse(raw);
    for (const item of existing) {
      const key = `${catalogService.normalizeName(item.artist)}:::${catalogService.normalizeName(item.title)}`;
      existingSet.add(key);
    }
  }
  console.log(`Existing tracks in manifest to preserve: ${existingSet.size}`);

  const discovered: DiscoveredTrack[] = [];
  const discoveredKeys = new Set<string>();

  // Curated archive item sources with genres and fallback metadata
  const sources = [
    // 1. Bollywood Duets & Evergreen Hits (Chinikam Collection)
    {
      identifier: '07KyaYahiPyarHai',
      defaultGenre: ['Bollywood', 'Hindi Film', 'Classic'],
      defaultLanguage: 'Hindi',
      parser: (f: any) => {
        let artist = 'Mohammed Rafi & Lata Mangeshkar';
        let album = 'Golden Bollywood Duets';
        if (f.name.includes('01 rafi lata')) {
          artist = 'Mohammed Rafi & Lata Mangeshkar';
          album = 'Rafi & Lata - Eternal Duets';
        } else if (f.name.includes('02 rafi asha')) {
          artist = 'Mohammed Rafi & Asha Bhosle';
          album = 'Rafi & Asha - Romantic Hits';
        } else if (f.name.includes('03 mukesh lata')) {
          artist = 'Mukesh & Lata Mangeshkar';
          album = 'Mukesh & Lata - Melodious Moments';
        } else if (f.name.includes('04 kishore lata')) {
          artist = 'Kishore Kumar & Lata Mangeshkar';
          album = 'Kishore & Lata - Timeless Classics';
        } else if (f.name.includes('old hits/KISHORE')) {
          artist = 'Kishore Kumar';
          album = 'Best of Kishore Kumar';
        } else if (f.name.includes('old hits/LATA')) {
          artist = 'Lata Mangeshkar';
          album = 'The Nightingale - Lata Mangeshkar';
        } else if (f.name.includes('old hits/MUKESH')) {
          artist = 'Mukesh';
          album = 'Soulful Voice of Mukesh';
        } else if (f.name.includes('old hits/RAFI')) {
          artist = 'Mohammed Rafi';
          album = 'The Inimitable Mohammed Rafi';
        }

        const base = path.basename(f.name);
        const title = cleanTitle(f.title || base);
        return { title, artist, album, year: 1972 };
      },
    },

    // 2. Vintage Rare Hindi Film Songs
    {
      identifier: 'OldRareHindiFilmSongs',
      defaultGenre: ['Hindi Film', 'Vintage', 'Golden Era'],
      defaultLanguage: 'Hindi',
      parser: (f: any) => {
        const base = path.basename(f.name, '.mp3');
        const parts = base.split('-');
        let album = 'Vintage Hindi Cinema';
        let year = 1955;
        let title = base;
        let artist = 'Lata Mangeshkar';

        if (parts.length >= 3) {
          album = cleanAlbum(parts[0], 'Vintage Hindi Cinema');
          const yrMatch = parts[1].match(/\b(19\d\d)\b/);
          if (yrMatch) year = Number.parseInt(yrMatch[1], 10);
          title = cleanTitle(parts.slice(2).join(' '));
        } else {
          title = cleanTitle(base);
        }

        return { title, artist, album, year };
      },
    },

    // 3. Vintage Rare Hindi Film Songs Vol 2
    {
      identifier: 'OldRareHindiFilmSongsVol2',
      defaultGenre: ['Hindi Film', 'Vintage', 'Golden Era'],
      defaultLanguage: 'Hindi',
      parser: (f: any) => {
        const base = path.basename(f.name, '.mp3');
        const parts = base.split('-');
        let album = 'Vintage Hindi Cinema Vol 2';
        let year = 1958;
        let title = base;
        let artist = 'Mohammed Rafi';

        if (parts.length >= 3) {
          album = cleanAlbum(parts[0], 'Vintage Hindi Cinema Vol 2');
          const yrMatch = parts[1].match(/\b(19\d\d)\b/);
          if (yrMatch) year = Number.parseInt(yrMatch[1], 10);
          title = cleanTitle(parts.slice(2).join(' '));
        } else {
          title = cleanTitle(base);
        }

        return { title, artist, album, year };
      },
    },

    // 4. Evergreen Dev Anand Songs sung by Kishore Kumar
    {
      identifier: 'EvergreenHitsOfDevAnandsungByKishoreKumar',
      defaultGenre: ['Bollywood', 'Hindi Film', 'Classic'],
      defaultLanguage: 'Hindi',
      parser: (f: any) => {
        const title = cleanTitle(f.title || path.basename(f.name));
        const artist = cleanArtist(f.artist, 'Kishore Kumar');
        const album = cleanAlbum(f.album, 'Evergreen Dev Anand Hits');
        return { title, artist, album, year: 1971 };
      },
    },

    // 5. Super Hit Ghazals in Hindi & Urdu
    {
      identifier: 'SuperHitGhazalsInHindiMp3',
      defaultGenre: ['Ghazal', 'Indian Classical', 'Poetry'],
      defaultLanguage: 'Hindi',
      parser: (f: any) => {
        const base = path.basename(f.name, '.mp3');
        let artist = 'Jagjit Singh';
        if (base.toLowerCase().includes('jagjit')) artist = 'Jagjit Singh';
        else if (base.toLowerCase().includes('asha')) artist = 'Asha Bhosle';
        else if (base.toLowerCase().includes('ghulam')) artist = 'Ghulam Ali';
        else if (base.toLowerCase().includes('mehdi')) artist = 'Mehdi Hassan';
        else if (base.toLowerCase().includes('chitra')) artist = 'Chitra Singh';

        const title = cleanTitle(f.title || base.replace(/-(?:JAGJIT|ASHA|GHULAM|MEHDI)/i, ''));
        const album = cleanAlbum(f.album, 'Super Hit Ghazals');
        return { title, artist, album, year: 1982 };
      },
    },

    // 6. Ghulam Ali Ghazals
    {
      identifier: 'GhulamAliGhazals25',
      defaultGenre: ['Ghazal', 'Sufi', 'Indian Classical'],
      defaultLanguage: 'Urdu',
      parser: (f: any) => {
        const title = cleanTitle(f.title || path.basename(f.name));
        const artist = 'Ghulam Ali';
        const album = 'Ghulam Ali - Best Ghazals';
        return { title, artist, album, year: 1980 };
      },
    },

    // 7. Punjabi Songs & Folk
    {
      identifier: 'PunjabiSadSongsAudio',
      defaultGenre: ['Punjabi', 'Folk', 'Regional'],
      defaultLanguage: 'Punjabi',
      parser: (f: any) => {
        const base = path.basename(f.name, '.mp3');
        const title = cleanTitle(f.title || base);
        const artist = cleanArtist(f.artist, 'Surinder Kaur');
        const album = 'Punjabi Folk & Melodies';
        return { title, artist, album, year: 1985 };
      },
    },

    // 8. Punjabi Best Songs
    {
      identifier: 'LalarLyadeRe',
      defaultGenre: ['Punjabi', 'Folk', 'Bhangra'],
      defaultLanguage: 'Punjabi',
      parser: (f: any) => {
        const base = path.basename(f.name, '.mp3');
        const title = cleanTitle(f.title || base);
        const artist = cleanArtist(f.artist, 'Gurdas Maan');
        const album = 'Best of Punjabi Hits';
        return { title, artist, album, year: 1990 };
      },
    },

    // 9. Indian Classical & Instrumental
    {
      identifier: 'HindustaniClassicalVersatileRaga',
      defaultGenre: ['Indian Classical', 'Hindustani', 'Instrumental'],
      defaultLanguage: 'Hindi',
      parser: (f: any) => {
        const title = cleanTitle(f.title || path.basename(f.name));
        const artist = 'Pandit Ravi Shankar & Ustad Bismillah Khan';
        const album = 'Hindustani Classical Ragas';
        return { title, artist, album, year: 1968 };
      },
    },

    // 10. Devotional Meera Krishna Bhajans
    {
      identifier: 'HindiBhajansMp3-meeraKrishnaBhajan',
      defaultGenre: ['Devotional', 'Bhajan', 'Spiritual'],
      defaultLanguage: 'Hindi',
      parser: (f: any) => {
        const title = cleanTitle(f.title || path.basename(f.name));
        const artist = 'Anup Jalota';
        const album = 'Meera Krishna Bhajans';
        return { title, artist, album, year: 1983 };
      },
    },

    // 11. Lata Mangeshkar 5000 Film Songs Part 1 (0742)
    {
      identifier: '0742-bhule-bhatke-logon-nastik',
      defaultGenre: ['Bollywood', 'Hindi Film', 'Classic'],
      defaultLanguage: 'Hindi',
      parser: (f: any) => {
        const base = path.basename(f.name, '.mp3');
        const parts = base.split(' - ');
        let title = base;
        let album = '5000 Hindi Film Songs';
        if (parts.length >= 3) {
          title = cleanTitle(parts[1]);
          album = cleanAlbum(parts[2], 'Lata Mangeshkar Film Classics');
        } else if (parts.length === 2) {
          title = cleanTitle(parts[1]);
        }
        return { title, artist: 'Lata Mangeshkar', album, year: 1954 };
      },
    },

    // 12. Lata Mangeshkar 5000 Film Songs Part 2 (1083)
    {
      identifier: '1083-ae-chand-kal-jo-aana-devta',
      defaultGenre: ['Bollywood', 'Hindi Film', 'Classic'],
      defaultLanguage: 'Hindi',
      parser: (f: any) => {
        const base = path.basename(f.name, '.mp3');
        const parts = base.split(' - ');
        let title = base;
        let album = '5000 Hindi Film Songs Vol 2';
        if (parts.length >= 3) {
          title = cleanTitle(parts[1]);
          album = cleanAlbum(parts[2], 'Lata Mangeshkar Golden Hits');
        } else if (parts.length === 2) {
          title = cleanTitle(parts[1]);
        }
        return { title, artist: 'Lata Mangeshkar', album, year: 1960 };
      },
    },

    // 13. Lata Mangeshkar 5000 Film Songs Part 3 (2750)
    {
      identifier: '2750-jab-se-huyi-us-paar',
      defaultGenre: ['Bollywood', 'Hindi Film', 'Classic'],
      defaultLanguage: 'Hindi',
      parser: (f: any) => {
        const base = path.basename(f.name, '.mp3');
        const parts = base.split(' - ');
        let title = base;
        let album = '5000 Hindi Film Songs Vol 3';
        if (parts.length >= 3) {
          title = cleanTitle(parts[1]);
          album = cleanAlbum(parts[2], 'Lata Mangeshkar Hits');
        } else if (parts.length === 2) {
          title = cleanTitle(parts[1]);
        }
        return { title, artist: 'Lata Mangeshkar', album, year: 1965 };
      },
    },

    // 14. Lata Mangeshkar 5000 Film Songs Part 4 (3978)
    {
      identifier: '3978-chanda-se-honga-wo-pyara-main-bhi-ladki-hoo',
      defaultGenre: ['Bollywood', 'Hindi Film', 'Classic'],
      defaultLanguage: 'Hindi',
      parser: (f: any) => {
        const base = path.basename(f.name, '.mp3');
        const parts = base.split(' - ');
        let title = base;
        let album = '5000 Hindi Film Songs Vol 4';
        if (parts.length >= 3) {
          title = cleanTitle(parts[1]);
          album = cleanAlbum(parts[2], 'Lata Mangeshkar Hits');
        } else if (parts.length === 2) {
          title = cleanTitle(parts[1]);
        }
        return { title, artist: 'Lata Mangeshkar', album, year: 1970 };
      },
    },
  ];

  for (const src of sources) {
    if (discovered.length >= targetCount) break;

    try {
      console.log(`Fetching metadata for collection: ${src.identifier}...`);
      const res = await fetch(`https://archive.org/metadata/${src.identifier}`);
      if (!res.ok) {
        console.warn(`  ⚠️ Failed to fetch metadata for ${src.identifier}: HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const files = (data.files || []).filter(
        (f: any) =>
          (f.format === 'VBR MP3' || f.format === 'MP3' || f.name.endsWith('.mp3')) &&
          !f.name.toLowerCase().includes('sample') &&
          Number(f.length || f.size || 0) > 0
      );

      console.log(`  Found ${files.length} audio files in ${src.identifier}`);

      // Check for item image/cover
      let itemArtworkUrl: string | undefined;
      const imageFile = (data.files || []).find((f: any) =>
        f.name.match(/\.(jpg|jpeg|png)$/i) && !f.name.includes('_thumb')
      );
      if (imageFile) {
        itemArtworkUrl = `https://archive.org/download/${src.identifier}/${encodeURIComponent(imageFile.name)}`;
      }

      for (const f of files) {
        if (discovered.length >= targetCount) break;

        const parsed = src.parser(f);
        if (!parsed.title || parsed.title.length < 2) continue;

        const normArtist = catalogService.normalizeName(parsed.artist);
        const normTitle = catalogService.normalizeName(parsed.title);
        const dedupeKey = `${normArtist}:::${normTitle}`;

        if (existingSet.has(dedupeKey) || discoveredKeys.has(dedupeKey)) {
          continue;
        }

        const sourceUrl = `https://archive.org/download/${src.identifier}/${encodeURIComponent(f.name)}`;
        const durationSec = f.length ? Math.round(Number.parseFloat(f.length)) : undefined;
        const sizeBytes = f.size ? Number.parseInt(f.size, 10) : undefined;

        // Skip non-music or tiny snippets (< 30 seconds)
        if (durationSec && durationSec < 30) continue;

        discovered.push({
          id: `ia_${src.identifier}_${crypto.createHash('sha256').update(`${src.identifier}:::${f.name}`).digest('hex').slice(0, 20)}`,
          sourceItem: src.identifier,
          sourceFile: f.name,
          sourceUrl,
          title: parsed.title,
          artist: parsed.artist,
          album: parsed.album,
          year: parsed.year,
          language: src.defaultLanguage,
          genre: src.defaultGenre,
          durationEstimate: durationSec,
          fileSizeBytes: sizeBytes,
          artworkUrl: itemArtworkUrl,
          format: 'MP3',
        });

        discoveredKeys.add(dedupeKey);
      }

      console.log(`  Discovered so far: ${discovered.length} / ${targetCount}`);
    } catch (err: any) {
      console.warn(`  ⚠️ Error processing ${src.identifier}: ${err.message}`);
    }
  }

  console.log(`\n🎉 Total discovered unique tracks: ${discovered.length} (Target: ${targetCount})`);

  // Persist discovered tracks to disk
  const outPath = path.join(env.localImportFolder, 'discovered-tracks.json');
  fs.writeFileSync(outPath, JSON.stringify(discovered, null, 2), 'utf8');
  console.log(`Saved discovered tracks manifest to: ${outPath}`);

  return discovered;
}

if (process.argv[1]?.endsWith('discoverIndianTracks.ts')) {
  discoverAllIndianTracks(995).catch(console.error);
}
