import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

interface TrackDownloadSpec {
  title: string;
  artist: string;
  album: string;
  slug: string;
  songPageUrl: string;
  downloadUrl: string;
  fileName: string;
  format: 'FLAC' | 'MP3';
  lossless: boolean;
  license: string;
  licenseUrl: string;
  attribution: string;
}

const targetTracks: TrackDownloadSpec[] = [
  {
    title: 'Crazy Glue',
    artist: 'Josh Woodward',
    album: 'The Wake',
    slug: 'CrazyGlue',
    songPageUrl: 'https://www.joshwoodward.com/song/CrazyGlue',
    downloadUrl: 'https://www.joshwoodward.com/flac/2012-TheWake/JoshWoodward-TheWake-04-CrazyGlue.flac',
    fileName: 'JoshWoodward-TheWake-04-CrazyGlue.flac',
    format: 'FLAC',
    lossless: true,
    license: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: '"Crazy Glue" by Josh Woodward (https://www.joshwoodward.com/), licensed under CC BY 4.0',
  },
  {
    title: 'Cherubs',
    artist: 'Josh Woodward',
    album: 'Ashes',
    slug: 'Cherubs',
    songPageUrl: 'https://www.joshwoodward.com/song/Cherubs',
    downloadUrl: 'https://www.joshwoodward.com/flac/2010-Ashes/JoshWoodward-Ashes-02-Cherubs.flac',
    fileName: 'JoshWoodward-Ashes-02-Cherubs.flac',
    format: 'FLAC',
    lossless: true,
    license: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: '"Cherubs" by Josh Woodward (https://www.joshwoodward.com/), licensed under CC BY 4.0',
  },
  {
    title: 'The Box',
    artist: 'Josh Woodward',
    album: 'The Box Single',
    slug: 'TheBox',
    songPageUrl: 'https://www.joshwoodward.com/song/TheBox',
    downloadUrl: 'https://www.joshwoodward.com/flac/uploads/JoshWoodward-TheBox.flac',
    fileName: 'JoshWoodward-TheBox.flac',
    format: 'FLAC',
    lossless: true,
    license: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: '"The Box" by Josh Woodward (https://www.joshwoodward.com/), licensed under CC BY 4.0',
  },
  {
    title: 'Let It In',
    artist: 'Josh Woodward',
    album: 'Ashes',
    slug: 'LetItIn',
    songPageUrl: 'https://www.joshwoodward.com/song/LetItIn',
    downloadUrl: 'https://www.joshwoodward.com/mp3/Ashes/JoshWoodward-Ashes-01-LetItIn.mp3',
    fileName: 'JoshWoodward-Ashes-01-LetItIn.mp3',
    format: 'MP3',
    lossless: false,
    license: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: '"Let It In" by Josh Woodward (https://www.joshwoodward.com/), licensed under CC BY 4.0',
  },
  {
    title: 'California Lullabye',
    artist: 'Josh Woodward',
    album: 'The Beautiful Machine',
    slug: 'CaliforniaLullabye',
    songPageUrl: 'https://www.joshwoodward.com/song/CaliforniaLullabye',
    downloadUrl: 'https://www.joshwoodward.com/mp3/JoshWoodward-TheBeautifulMachine-01-CaliforniaLullabye.mp3',
    fileName: 'JoshWoodward-TheBeautifulMachine-01-CaliforniaLullabye.mp3',
    format: 'MP3',
    lossless: false,
    license: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: '"California Lullabye" by Josh Woodward (https://www.joshwoodward.com/), licensed under CC BY 4.0',
  },
];

async function run() {
  const audioDir = path.join(os.tmpdir(), 'dhun-test-audio');
  const importDir = path.resolve(process.cwd(), '../DhunMusicImport');
  const manifestPath = path.join(importDir, 'attribution-manifest.json');

  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  console.log(`\n================================================================`);
  console.log(`🎵 Downloading Verified Creative Commons Test Dataset`);
  console.log(`================================================================`);
  console.log(`Artist: Josh Woodward (Official Downloads: https://www.joshwoodward.com/)`);
  console.log(`Target Folder: ${audioDir}\n`);

  const results = [];

  for (let i = 0; i < targetTracks.length; i++) {
    const track = targetTracks[i];
    const destPath = path.join(audioDir, track.fileName);
    const baseName = path.basename(track.fileName, path.extname(track.fileName));
    const lyricsDestPath = path.join(audioDir, `${baseName}.txt`);

    console.log(`[${i + 1}/${targetTracks.length}] Checking ${track.title} (${track.format})...`);

    let downloadStatus = 'downloaded';

    if (fs.existsSync(destPath)) {
      console.log(`   ⏭️  File already exists locally (${track.fileName}). Skipping download to avoid overwriting.`);
      downloadStatus = 'already_exists';
    } else {
      console.log(`   📥 Downloading from ${track.downloadUrl}...`);
      try {
        execSync(`curl -sSL -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" "${track.downloadUrl}" -o "${destPath}"`);
        const stats = fs.statSync(destPath);
        console.log(`   ✅ Download complete: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      } catch (err: any) {
        console.error(`   ❌ Failed to download ${track.title}: ${err.message}`);
        downloadStatus = 'failed';
      }
    }

    // Extract official lyrics from artist page if not already saved
    if (!fs.existsSync(lyricsDestPath)) {
      try {
        const html = execSync(`curl -s -A "Mozilla/5.0" "${track.songPageUrl}"`).toString();
        const pushRegex = /self\.__next_f\.push\(\[1,\s*\"([\s\S]*?)\"\]\)/g;
        let combined = '';
        let m;
        while ((m = pushRegex.exec(html)) !== null) {
          try { combined += JSON.parse('\"' + m[1] + '\"'); } catch(e) { combined += m[1]; }
        }
        const lyricsMatch = combined.match(/\"lyrics\":\"([\s\S]*?)\",\"tab\"/);
        if (lyricsMatch && lyricsMatch[1]) {
          const rawLyrics = lyricsMatch[1]
            .replace(/\\r\\n/g, '\n')
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"');
          fs.writeFileSync(lyricsDestPath, rawLyrics, 'utf8');
          console.log(`   📝 Saved official companion lyrics: ${path.basename(lyricsDestPath)}`);
        }
      } catch (err: any) {
        console.warn(`   ⚠️ Could not fetch lyrics for ${track.title}: ${err.message}`);
      }
    }

    const fileSizeBytes = fs.existsSync(destPath) ? fs.statSync(destPath).size : 0;

    results.push({
      ...track,
      localFilePath: destPath,
      fileSizeBytes,
      downloadStatus,
      hasLyricsFile: fs.existsSync(lyricsDestPath),
    });
  }

  // Save attribution manifest
  const manifestData = {
    source: 'Official artist website of Josh Woodward',
    sourceUrl: 'https://www.joshwoodward.com/',
    licenseNotice: 'All music licensed under Creative Commons Attribution 4.0 International (CC BY 4.0). Free to share and adapt with appropriate credit.',
    verifiedAt: new Date().toISOString(),
    tracks: results.map((r) => ({
      title: r.title,
      artist: r.artist,
      album: r.album,
      fileName: r.fileName,
      format: r.format,
      lossless: r.lossless,
      fileSizeBytes: r.fileSizeBytes,
      songPageUrl: r.songPageUrl,
      downloadUrl: r.downloadUrl,
      license: r.license,
      licenseUrl: r.licenseUrl,
      attribution: r.attribution,
      downloadStatus: r.downloadStatus,
    })),
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), 'utf8');
  console.log(`\n================================================================`);
  console.log(`📄 Attribution manifest written to: ${manifestPath}`);
  console.log(`================================================================\n`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
