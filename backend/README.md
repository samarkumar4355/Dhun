# Dhun Backend — Music Streaming & Lossless Offline Audio Engine

Dhun is a high-fidelity music platform backend built with Node.js, Express, TypeScript, and MongoDB. It provides lossless audio streaming, Google Drive library ingestion with cryptographic integrity checks, connected artist/album/genre catalog modeling, user playlists, offline library delta synchronization, and interactive OpenAPI documentation.

---

## 1. Architecture Overview

```
                      ┌─────────────────────────────────────────┐
                      │    Mobile Client (React Native/Expo)    │
                      └────────────────────┬────────────────────┘
                                           │
                       REST API Requests   │  Range Requests / Downloads
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │      Dhun Express API (/api/v1)        │
                      ├─────────────────────────────────────────┤
                      │ • Auth & Rate Limiting Middleware       │
                      │ • Input Validation (Zod)                │
                      │ • Standard Response & Redacted Logging  │
                      └───────┬──────────────────────┬──────────┘
                              │                      │
             Catalog & User Services                 │ Playback & Sync Services
                              │                      │
                 ┌────────────▼─────────┐    ┌───────▼───────────┐
                 │    MongoDB Atlas     │    │  Streaming Engine │
                 ├──────────────────────┤    ├───────────────────┤
                 │ • Tracks             │    │ • RFC 7233 Range  │
                 │ • Artists            │    │ • 206 Partial     │
                 │ • Albums             │    │ • Zero Memory     │
                 │ • Genres             │    │   Buffering       │
                 │ • Users              │    └─────────┬─────────┘
                 │ • Playlists          │              │
                 │ • Favorites          │              ▼
                 │ • Library Items      │    ┌───────────────────┐
                 │ • Listening History  │    │ Media Storage     │
                 └──────────────────────┘    │ • Local Staging   │
                                             │ • Google Drive API│
                                             └───────────────────┘
```

### Relational Catalog Model
- **`Track`**: Core audio entity containing technical audio properties (`codec`, `bitDepth`, `sampleRate`, `bitrate`, `channels`, `isLossless`), audio checksums (`SHA-256`, Drive `MD5`), lyrics text with line breaks preserved, artwork references, and relational links to:
  - `primaryArtist` (`ObjectId` → `Artist`)
  - `featuredArtists` (`ObjectId[]` → `Artist[]`)
  - `albumRef` (`ObjectId` → `Album`)
  - `genreRefs` (`ObjectId[]` → `Genre[]`)
- **`Artist`**: Canonical normalized name (`nameNormalized`), biography, artwork URL, and linked genres.
- **`Album`**: Title, release year, album type (`album`, `ep`, `single`, `compilation`), artwork URL, linked artists, and track list.
- **`Genre`**: Canonical genre name, normalized slug, optional parent genre for hierarchies (e.g. `Hindustani classical` → `Classical`).
- **`User`**: Bcrypt password hash, refresh token rotation list, and single-use password reset tokens.
- **`Favorite`**: Compound unique index `{ user: 1, track: 1 }` preventing duplicate favorites.
- **`LibraryItem`**: Compound unique index `{ user: 1, track: 1 }` for saved user library.
- **`Playlist`**: Explicit track ordering with `tracks: [{ track, position, addedAt }]` and user ownership.
- **`ListeningHistory`**: Track plays, duration listened, and last played timestamp.

---

## 2. Directory Structure

```
backend/
├── credentials/                 # (Git-ignored) OAuth client credentials & tokens
├── dist/                        # Compiled production JavaScript bundle
├── src/
│   ├── config/
│   │   └── env.ts               # Environment configuration & path resolvers
│   ├── middleware/
│   │   ├── auth.middleware.ts   # JWT authentication & admin role guard
│   │   ├── error.middleware.ts  # Global error handler with secret redaction
│   │   ├── rateLimit.middleware.ts # Sliding-window IP rate limiter
│   │   └── validate.middleware.ts  # Zod schema request validator
│   ├── models/
│   │   ├── album.model.ts       # Album schema & indexes
│   │   ├── artist.model.ts      # Artist schema & indexes
│   │   ├── favorite.model.ts    # User favorites schema
│   │   ├── genre.model.ts       # Genre schema & hierarchy
│   │   ├── history.model.ts     # Listening history schema
│   │   ├── library.model.ts     # Saved user library schema
│   │   ├── playlist.model.ts    # Playlist schema with explicit positions
│   │   ├── track.model.ts       # Track schema & text search indexes
│   │   └── user.model.ts        # User credentials & tokens schema
│   ├── routes/
│   │   ├── admin.routes.ts      # Catalog reconciliation & entity merging
│   │   ├── album.routes.ts      # Album list & details with tracks
│   │   ├── artist.routes.ts     # Artist list, tracks, & albums
│   │   ├── auth.routes.ts       # User registration, login, JWT rotation, & Google OAuth
│   │   ├── docs.routes.ts       # OpenAPI 3.0 JSON specification & interactive UI
│   │   ├── genre.routes.ts      # Genre list & genre tracks
│   │   ├── health.routes.ts     # Health (/health) and readiness (/ready) probes
│   │   ├── playlist.routes.ts   # Playlist CRUD, add/remove tracks, reordering
│   │   ├── search.routes.ts     # Unified search across tracks, artists, albums, playlists
│   │   ├── sync.routes.ts       # Delta changes sync & offline download manifest
│   │   ├── track.routes.ts      # Track catalog, streaming, playback info, lyrics
│   │   └── user.routes.ts       # Personal favorites, library, history, recommendations
│   ├── scripts/
│   │   ├── runDryRun.ts         # Dry-run importer script
│   │   ├── runLiveImport.ts     # Safe live importer script with account check
│   │   └── testDriveConnection.ts # Google Drive connection test
│   ├── services/
│   │   ├── auth.service.ts      # Authentication, password hashing, JWT rotation
│   │   ├── catalog.service.ts   # Normalization, entity linking, & backfill migration
│   │   ├── googleDrive.service.ts # Google Drive OAuth, uploads, and MD5 validation
│   │   ├── library.service.ts   # Favorites, playlists, library, and history
│   │   ├── metadata.service.ts  # music-metadata extraction, lossless checks, lyrics validation
│   │   ├── playback.service.ts  # RFC 7233 byte-range streaming engine
│   │   ├── recommendation.service.ts # Rule-based personalized recommendations
│   │   └── sync.service.ts      # Offline download manifest & delta change tracking
│   ├── utils/
│   │   ├── logger.ts            # Structured logger with sensitive credential redaction
│   │   └── response.ts          # Standard API response envelope & helpers
│   ├── workers/
│   │   └── importer.ts          # Safe music ingestion worker
│   └── index.ts                 # Express application entry point & graceful shutdown
├── test/
│   ├── auth.test.ts             # Password hashing, JWT token lifecycle tests
│   ├── catalog.test.ts          # Normalization, collaborator parsing tests
│   ├── importer.test.ts         # Media integrity, checksum, & dry-run tests
│   ├── library-sync.test.ts     # Playlists, offline manifest, recommendation tests
│   └── playback.test.ts         # RFC 7233 range request parser tests
├── .env.example                 # Safe environment configuration template
├── package.json                 # Project dependencies and npm scripts
└── tsconfig.json                # TypeScript compiler configuration
```

---

## 3. Installation & Setup

### Prerequisites
- Node.js `v18+` (or `v20+`)
- npm or yarn
- MongoDB Atlas database URI (or local MongoDB `v6+`)

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Ensure the following variables are configured:
```env
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/dhun?retryWrites=true&w=majority

# OAuth & Drive paths (relative to backend/)
GOOGLE_CREDENTIALS_PATH=../credentials/credentials.json
GOOGLE_TOKEN_PATH=../credentials/tokens.json
GOOGLE_DRIVE_ROOT_FOLDER="Dhun Music Library"
LOCAL_IMPORT_FOLDER=../DhunMusicImport

# JWT Secrets (generate secure 32+ byte strings in production)
JWT_SECRET=your-random-32-byte-hex-secret-for-access-tokens
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-random-32-byte-hex-secret-for-refresh-tokens
JWT_REFRESH_EXPIRES_IN=7d
ADMIN_API_KEY=your-secure-admin-api-key-here
```

---

## 4. Google Drive OAuth & Music Importer

The importer scans audio files from `DhunMusicImport/audio/`, extracts technical audio metadata without transcoding, verifies SHA-256 and MD5 checksums, preserves genuine lyrics, and links songs to canonical catalog entities.

### Importer Safeguards
1. **Google Account Verification**: Retrieves authenticated user info (`about.get`) and verifies account identity before live uploads.
2. **Explicit Confirmation**: Rejects live operations without `--yes` or explicit interactive confirmation.
3. **No Transcoding**: Original audio bytes are preserved identically.
4. **Checksum Verification**: Reuses remote Drive files only if both file size and remote MD5 match case-insensitively.
5. **Safe Lyrics Handling**: Ignores empty/tiny placeholder tokens; preserves legitimate multi-line lyrics and verse breaks.
6. **Reconciliation & Idempotency**: Supports safe reruns without creating duplicate entities or duplicate Drive files.

### Importer Commands
- **Dry Run** (scans files and reports status without modifying Google Drive or MongoDB):
  ```bash
  npm run import:dry-run
  ```
- **Live Import** (prompts for confirmation and imports authorized tracks):
  ```bash
  npm run import:upload
  ```
- **Live Import with Explicit Confirmation Flag**:
  ```bash
  npm run import:upload -- --yes
  ```

---

## 5. API Reference & Documentation

Interactive API documentation and the OpenAPI 3.0 JSON specification are available when the server is running:
- **Interactive Documentation**: `http://localhost:5001/api/v1/docs`
- **OpenAPI Specification**: `http://localhost:5001/api/v1/openapi.json`

### Route Groups Summary

#### Health & System
- `GET /health`: Liveness probe. Returns server status, uptime, and timestamp.
- `GET /ready`: Readiness probe. Returns MongoDB database connectivity status (`200 OK` if connected, `503 Service Unavailable` otherwise).

#### Authentication (`/api/v1/auth`)
- `POST /register`: Register a new user (`email`, `password`, `displayName`).
- `POST /login`: Log in with email and password. Returns user object, access token, and refresh token.
- `POST /refresh`: Secure refresh token rotation. Issues a new access token and invalidates old refresh token.
- `POST /logout`: Invalidate refresh token.
- `POST /forgot-password`: Request single-use password reset token.
- `POST /reset-password`: Reset password using valid reset token.
- `GET /me`: Get authenticated user profile (`Bearer <token>`).
- `GET /status`: Google Drive OAuth connection status.
- `GET /connect`: Start Google Drive OAuth browser authorization.

#### Music Catalog (`/api/v1`)
- `GET /tracks`: List catalog tracks with pagination (`page`, `limit`), `search`, and filters (`isLossless`, `artist`, `album`, `genre`).
- `GET /tracks/:id`: Retrieve full track details including linked artists, album, genres, technical audio properties, artwork, and full lyrics.
- `GET /tracks/:id/playback`: Get authorized playback metadata and streaming URL.
- `GET /tracks/:id/stream`: Stream audio with HTTP Range support (`206 Partial Content`) for seeking and pausing.
- `GET /tracks/:id/lyrics`: Get track lyrics text and availability.
- `GET /tracks/:id/related`: Get related tracks sharing artists or verified genres.
- `GET /artists`: List artists with pagination and search.
- `GET /artists/:id`: Artist profile and associated genres.
- `GET /artists/:id/tracks`: All tracks by artist (primary and featured).
- `GET /artists/:id/albums`: All albums by artist.
- `GET /albums`: List albums with pagination.
- `GET /albums/:id`: Album details and complete ordered track list.
- `GET /genres`: List canonical genres and hierarchies.
- `GET /genres/:id`: Genre details.
- `GET /genres/:id/tracks`: Tracks belonging to genre.
- `GET /search`: Unified search across tracks, artists, albums, and playlists.

#### User Library & Playlists (`/api/v1/me` & `/api/v1/playlists`)
- `GET /me/favorites`: List user's favorite tracks with pagination.
- `PUT /me/favorites/:trackId`: Add track to favorites (compound unique index prevents duplicates).
- `DELETE /me/favorites/:trackId`: Remove track from favorites.
- `GET /me/library`: List saved tracks in personal library.
- `POST /me/library/:trackId`: Save track to library.
- `DELETE /me/library/:trackId`: Remove track from library.
- `GET /me/playlists`: List playlists owned by authenticated user.
- `POST /playlists`: Create a new playlist (`title`, `description`, `isPublic`).
- `GET /playlists/:id`: Retrieve playlist details and ordered track list.
- `PATCH /playlists/:id`: Update playlist metadata (`title`, `description`, `isPublic`).
- `DELETE /playlists/:id`: Delete playlist (owner only).
- `POST /playlists/:id/tracks`: Add track to playlist.
- `DELETE /playlists/:id/tracks/:trackId`: Remove track from playlist.
- `PATCH /playlists/:id/order`: Reorder tracks with an explicit ordered array of track IDs.

#### Listening History & Recommendations (`/api/v1/me` & `/api/v1/discover`)
- `GET /me/history`: Get recent playback history with pagination.
- `POST /me/history`: Record track play event (`trackId`, `durationPlayedSeconds`, `completed`).
- `DELETE /me/history`: Clear listening history.
- `GET /me/recommendations`: Rule-based personalized recommendations based on listening frequency and top genres.
- `GET /discover`: Curated collections, recently added tracks, and lossless highlights.

#### Offline Synchronization (`/api/v1/sync`)
- `GET /sync/changes?since=<ISO_TIMESTAMP>`: Delta synchronization endpoint returning added or modified tracks since the given timestamp.
- `POST /sync/download-manifest`: Generate an authorized offline download manifest for an array of track IDs. Each item includes:
  - Stable track ID
  - Original file checksum (`SHA-256` and Google Drive `MD5`)
  - Audio file size in bytes
  - Authorized streaming / download URL
  - Full lyrics text
  - Artwork URL

#### Admin Catalog Management (`/api/v1/admin`)
- Requires `x-admin-key: <ADMIN_API_KEY>` or Admin JWT role.
- `GET /admin/import/status`: Live import status, manifest count, and Drive folder health.
- `POST /admin/catalog/reconcile`: Trigger backfill migration linking existing tracks to Artist, Album, and Genre entities.
- `PATCH /admin/tracks/:id`: Update track title, artist associations, album, or genre references.
- `POST /admin/artists/merge`: Safely merge duplicate artist entities into a canonical target artist.

---

## 6. Playback & Audio Streaming Design

The streaming engine in `src/services/playback.service.ts`:
1. Inspects the incoming HTTP `Range` header (RFC 7233).
2. For byte ranges (e.g., `bytes=0-1023` or `bytes=1000-`), returns `206 Partial Content` with `Content-Range: bytes <start>-<end>/<total>` and `Accept-Ranges: bytes`.
3. Streams audio directly to the response socket using Node.js read streams. Files are **never buffered into memory**, maintaining low RAM usage even with large high-resolution FLAC files (e.g. 50MB+).
4. For non-range requests, delivers `200 OK` with `Content-Length` and `Accept-Ranges: bytes` allowing clients to initiate seeking immediately.

---

## 7. Testing

The backend includes 48 unit and integration tests using Node.js's native test runner (`node:test`) and `tsx`.

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Importer safeguards and metadata tests
npm run test:importer

# Authentication & JWT security tests
npx tsx --test test/auth.test.ts

# Catalog normalization & parsing tests
npx tsx --test test/catalog.test.ts

# RFC 7233 byte-range playback parser tests
npx tsx --test test/playback.test.ts

# User library, playlist ordering, & offline manifest tests
npx tsx --test test/library-sync.test.ts
```

### Type Checking & Build
```bash
# TypeScript verification
npx tsc --noEmit

# Production build
npm run build
```

---

## 8. Security & Production Considerations

- **Secret Redaction**: Passwords, refresh tokens, Google OAuth client secrets, and private credentials are automatically redacted by `src/utils/logger.ts` before writing to log streams.
- **Graceful Shutdown**: Handles `SIGINT` and `SIGTERM` signals, closing active HTTP connections and disconnecting from MongoDB Atlas cleanly.
- **Rate Limiting**: Sliding-window in-memory rate limiting applied to sensitive endpoints (`/api/v1/auth/login`, `/register`, `/forgot-password`).
- **NoSQL Injection Defense**: Object IDs and queries are validated with Zod and Mongoose before execution.
