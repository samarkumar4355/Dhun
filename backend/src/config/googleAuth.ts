import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { exec } from 'node:child_process';
import readline from 'node:readline';
import 'google-auth-library/build/src/auth/baseexternalclient.js';
import { OAuth2Client, type Credentials } from 'google-auth-library';
// @ts-ignore - targeted import avoids circular export crash in googleapis accesscontextmanager on Node 26
import { drive } from 'googleapis/build/src/apis/drive/index.js';
import { env } from './env.js';

/**
 * SCOPE SELECTION & PRIVACY EXPLANATION:
 * 
 * We request ONLY the minimum necessary scope:
 *   'https://www.googleapis.com/auth/drive.file'
 *
 * Why this scope?
 * - Grants permission to create new folders (e.g., "Dhun Music Library") and upload files (audio, art, lyrics).
 * - Enforces the principle of least privilege: Dhun can ONLY view and manage files and folders
 *   that Dhun itself created or opened.
 *
 * Limitations:
 * - Dhun CANNOT view, search, modify, or delete your existing personal Drive files,
 *   documents, spreadsheets, photos, or other folders outside Dhun.
 * - This ensures complete user privacy and prevents unintended file modifications.
 */
export const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
];

interface ClientCredentialsStructure {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
}

/**
 * Loads the OAuth client configuration from the credentials JSON file.
 * If missing, throws a descriptive error guiding the user on how to resolve it.
 */
export function loadOAuthCredentials(): { clientId: string; clientSecret: string; redirectUri: string } {
  const credentialsPath = env.credentialsPath;

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(
      `[OAuth Setup Error] Google OAuth credentials file not found!\n` +
      `Expected location: ${credentialsPath}\n\n` +
      `Action required:\n` +
      `1. Open Google Cloud Console: https://console.cloud.google.com/\n` +
      `2. Go to APIs & Services > Credentials.\n` +
      `3. Download the OAuth 2.0 Client ID (Desktop app) JSON file.\n` +
      `4. Rename and place it at: ${credentialsPath}\n`
    );
  }

  try {
    const rawContent = fs.readFileSync(credentialsPath, 'utf8');
    const parsed: ClientCredentialsStructure = JSON.parse(rawContent);
    const clientConfig = parsed.installed || parsed.web;

    if (!clientConfig || !clientConfig.client_id || !clientConfig.client_secret) {
      throw new Error(
        `[OAuth Setup Error] The credentials file at ${credentialsPath} is missing client_id or client_secret.\n` +
        `Please ensure you downloaded the correct OAuth 2.0 Desktop app client credentials from Google Cloud Console.`
      );
    }

    // For desktop installed apps with loopback, redirectUri will be http://localhost:${port}
    const redirectUri = `http://localhost:${env.oauthRedirectPort}`;

    return {
      clientId: clientConfig.client_id,
      clientSecret: clientConfig.client_secret,
      redirectUri,
    };
  } catch (error: any) {
    if (error.message.includes('[OAuth Setup Error]')) {
      throw error;
    }
    throw new Error(`Failed to parse credentials file at ${credentialsPath}: ${error.message}`);
  }
}

/**
 * Creates an unauthenticated or partially configured OAuth2Client instance.
 */
export function createOAuth2Client(): OAuth2Client {
  const { clientId, clientSecret, redirectUri } = loadOAuthCredentials();
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

/**
 * Loads existing tokens from local storage if available.
 * Returns null if no valid tokens exist yet.
 */
export function loadSavedTokens(): Credentials | null {
  const tokenPath = env.tokenPath;
  if (!fs.existsSync(tokenPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(tokenPath, 'utf8');
    const tokens: Credentials = JSON.parse(raw);
    return tokens;
  } catch {
    return null;
  }
}

/**
 * Saves tokens securely to disk and ensures parent directory exists.
 * Excludes secrets from being printed to logs.
 */
export function saveTokens(tokens: Credentials): void {
  const tokenPath = env.tokenPath;
  const dir = path.dirname(tokenPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

/**
 * Prompts user in terminal for the auth code (fallback mode).
 */
function askForCodeInTerminal(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('\nPaste the authorization code from the browser here: ', (code) => {
      rl.close();
      resolve(code.trim());
    });
  });
}

/**
 * Starts a temporary HTTP server on localhost to listen for the OAuth2 callback.
 * If browser cannot redirect, provides fallback to paste code in terminal.
 */
function captureAuthorizationCode(oauth2Client: OAuth2Client, authUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        if (!req.url) {
          res.writeHead(400);
          res.end('Bad Request');
          return;
        }

        const urlObj = new URL(req.url, `http://localhost:${env.oauthRedirectPort}`);
        const code = urlObj.searchParams.get('code');
        const error = urlObj.searchParams.get('error');

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #0f172a; color: #f87171;">
                <h2>Authentication Cancelled or Denied</h2>
                <p>Error: ${error}</p>
                <p>You can close this tab and return to the terminal.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error(`OAuth authorization error from Google: ${error}`));
          return;
        }

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #0f172a; color: #f8fafc;">
                <h2 style="color: #4ade80;">Authorization Successful!</h2>
                <p>Google Drive authorization was completed successfully for Dhun.</p>
                <p>You can safely close this window and return to your terminal.</p>
              </body>
            </html>
          `);
          server.close();
          resolve(code);
        }
      } catch (err) {
        res.writeHead(500);
        res.end('Server error processing authentication callback.');
        server.close();
        reject(err);
      }
    });

    server.listen(env.oauthRedirectPort, () => {
      console.log(`\n================================================================`);
      console.log(`🔑 Google Drive Authorization Required`);
      console.log(`================================================================`);
      console.log(`Minimal Permission Requested:`);
      console.log(`• drive.file -> Manage only files and folders created by Dhun.`);
      console.log(`\nOpening your browser to authorize your Google account...`);
      console.log(`If the browser does not open automatically, visit this URL:\n`);
      console.log(authUrl);
      console.log(`================================================================\n`);

      // Attempt to open the default browser on macOS
      exec(`open "${authUrl}"`, (err) => {
        if (err) {
          console.log(`Could not automatically open browser. Please copy and paste the URL above.`);
        }
      });
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`\nNotice: Port ${env.oauthRedirectPort} is in use. Falling back to terminal input.`);
        askForCodeInTerminal()
          .then(resolve)
          .catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Gets an authenticated Google OAuth2 client.
 * If saved tokens exist, validates and auto-refreshes them.
 * If not, executes the interactive OAuth consent flow in the browser.
 */
export async function getAuthenticatedOAuth2Client(): Promise<OAuth2Client> {
  const oauth2Client = createOAuth2Client();
  const savedTokens = loadSavedTokens();

  if (savedTokens) {
    oauth2Client.setCredentials(savedTokens);

    // Set up auto-saving of refreshed tokens
    oauth2Client.on('tokens', (refreshedTokens) => {
      const currentTokens = loadSavedTokens() || {};
      const mergedTokens: Credentials = {
        ...currentTokens,
        ...refreshedTokens,
      };
      saveTokens(mergedTokens);
    });

    return oauth2Client;
  }

  // Generate OAuth URL requesting offline access to receive a refresh token
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: DRIVE_SCOPES,
  });

  const code = await captureAuthorizationCode(oauth2Client, authUrl);
  const { tokens } = await oauth2Client.getToken(code);

  oauth2Client.setCredentials(tokens);
  saveTokens(tokens);

  console.log(`Authorization successful! Tokens securely saved to local storage.`);
  return oauth2Client;
}

/**
 * Initializes and returns the official Google Drive API client (drive_v3.Drive).
 */
export async function getGoogleDriveClient() {
  const auth = await getAuthenticatedOAuth2Client();
  return drive({ version: 'v3', auth });
}
