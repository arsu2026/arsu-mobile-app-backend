import { Router } from 'express';

// ─────────────────────────────────────────────────────────────────────────────
// Root API Router
// ─────────────────────────────────────────────────────────────────────────────
// Import and mount feature module routers here as you build them.
// Example:
//   import { authRouter } from '../modules/auth/auth.routes';
//   router.use('/auth', authRouter);
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();

// ── API Version Info ──────────────────────────────────────────────────────────
router.get('/', (_req, res) => {
  res.json({
    name: 'ARSU Mobile App API',
    version: '1.0.0',
    status: 'operational',
    docs: '/api/v1/docs',
  });
});

export default router;
