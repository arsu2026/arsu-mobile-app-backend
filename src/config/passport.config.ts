import { PassportStatic } from 'passport';
import { Strategy as JwtStrategy, ExtractJwt, StrategyOptionsWithoutRequest } from 'passport-jwt';
import { Strategy as LocalStrategy } from 'passport-local';
import { env } from './env.config';

// ─────────────────────────────────────────────────────────────────────────────
// JWT Strategy Options
// ─────────────────────────────────────────────────────────────────────────────
const jwtOptions: StrategyOptionsWithoutRequest = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: env.JWT_SECRET,
  algorithms: ['HS256'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Configure Passport strategies
// Add new strategies here as the app grows
// ─────────────────────────────────────────────────────────────────────────────
export function configurePassport(passport: PassportStatic): void {
  // ── JWT Strategy (Bearer token auth) ──────────────────────────────────────
  passport.use(
    'jwt',
    new JwtStrategy(jwtOptions, async (payload, done) => {
      try {
        // payload.sub = user ID from token
        // Actual user lookup will be implemented in the auth module
        return done(null, payload);
      } catch (error) {
        return done(error, false);
      }
    }),
  );

  // ── Local Strategy (username/password login) ──────────────────────────────
  passport.use(
    'local',
    new LocalStrategy(
      { usernameField: 'email', passwordField: 'password' },
      async (_email, _password, done) => {
        // Actual validation will be implemented in the auth module
        return done(null, false, { message: 'Not implemented yet' });
      },
    ),
  );

  // ── Serialize / Deserialize (for session-based auth) ─────────────────────
  passport.serializeUser((user: Express.User & { id?: string }, done) =>
    done(null, (user as any).id),
  );
  passport.deserializeUser(async (id: string, done) =>
    done(null, { id, sub: id, email: '' } as Express.User),
  );
}
