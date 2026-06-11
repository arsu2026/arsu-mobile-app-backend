import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';

// ─────────────────────────────────────────────────────────────────────────────
// Root API Router
// ─────────────────────────────────────────────────────────────────────────────
// Import and mount feature module routers here as you build them.
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();

// ── Feature Modules ───────────────────────────────────────────────────────────
router.use('/auth', authRouter);

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
