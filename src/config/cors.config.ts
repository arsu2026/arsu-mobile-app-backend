import { CorsOptions } from 'cors';
import { env } from './env.config';

// ─────────────────────────────────────────────────────────────────────────────
// CORS Configuration
// ─────────────────────────────────────────────────────────────────────────────
// Flutter clients operate in several networking contexts:
//
//   • Android emulator  → uses 10.0.2.2 to reach the host machine
//   • iOS simulator     → uses localhost / 127.0.0.1
//   • Physical devices  → hit the server's real IP / domain directly (no CORS)
//   • Swagger UI / Web  → browser tab origin (http://localhost:<port>)
//
// Mobile HTTP stacks (Dart's dart:io / http / dio) do NOT send an Origin header
// for pure mobile-to-server requests, so those requests arrive with origin===undefined
// and are always allowed by the !origin guard below.  When the Flutter web target
// or Swagger UI is used from a browser tab, an Origin IS sent and must be listed.
//
// In development every origin is allowed so the team can iterate freely.
// In production only the origins listed in ALLOWED_ORIGINS are permitted.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise a raw ALLOWED_ORIGINS string into a deduplicated array.
 * Falls back to a comprehensive set of localhost variants used by
 * Flutter tooling so the server works out of the box in development
 * without any .env configuration.
 */
function buildAllowedOrigins(): string[] {
  const raw = process.env['ALLOWED_ORIGINS'];
  if (raw && raw.trim().length > 0) {
    return raw
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }

  // Default development origins — covers every Flutter / web dev scenario
  return [
    // Flutter web & Swagger UI on common dev ports
    'http://localhost:3000',
    'http://localhost:10000',
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:5000',
    'http://localhost:4000',
    // Android emulator host alias
    'http://10.0.2.2:3000',
    'http://10.0.2.2:10000',
    'http://10.0.2.2:8080',
    // 127.0.0.1 variants (iOS simulator, some Android configs)
    'http://127.0.0.1:3000',
    'http://127.0.0.1:10000',
    'http://127.0.0.1:8080',
  ];
}

const allowedOrigins = buildAllowedOrigins();

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // ── No origin header ──────────────────────────────────────────────────────
    // Native mobile apps (Flutter on Android/iOS), curl, Postman, and server-to-
    // server calls never send an Origin header.  Always allow these.
    if (!origin) return callback(null, true);

    // ── Development: allow everything ─────────────────────────────────────────
    // Makes local iteration frictionless without having to enumerate every port.
    if (env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    // ── Localhost / 127.0.0.1 / 10.0.2.2 — always allowed regardless of port ──
    // Flutter web dev server picks a random ephemeral port on every run, so
    // a fixed-port allowlist would never match.  These origins are only reachable
    // on the developer's own machine, so there is no meaningful security risk.
    const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/;
    if (localhostPattern.test(origin)) {
      return callback(null, true);
    }

    // ── Production / staging: explicit allowlist ───────────────────────────────
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Deny unknown origins with a descriptive error (not surfaced to the client
    // in production — Express's CORS package returns a generic 500 message).
    return callback(
      new Error(`CORS policy: Origin "${origin}" is not in the allowed list`),
    );
  },

  // Allow cookies / Authorization headers to be sent cross-origin.
  // Required for Bearer-token auth from browser-based Flutter web builds.
  credentials: true,

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Request-ID',
    'Accept',
    'Origin',
  ],

  // Expose these headers so Flutter clients can read them
  exposedHeaders: ['X-Request-ID', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],

  // Cache preflight response for 24 hours — reduces OPTIONS round-trips
  maxAge: 86400,

  // Automatically respond to OPTIONS preflight requests
  preflightContinue: false,
  optionsSuccessStatus: 204,
};
