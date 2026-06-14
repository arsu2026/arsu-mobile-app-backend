import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { postRouter } from '../modules/post/post.routes';
import { profileRouter } from '../modules/profile/profile.routes';
import { searchRouter } from '../modules/search/search.routes';
import { settingsRouter } from '../modules/settings/settings.routes';

// ─────────────────────────────────────────────────────────────────────────────
// Root API Router
// ─────────────────────────────────────────────────────────────────────────────
// Import and mount feature module routers here as you build them.
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();

// ── Feature Modules ───────────────────────────────────────────────────────────
router.use('/auth', authRouter);
router.use('/profile', profileRouter);
router.use('/search', searchRouter);
router.use('/settings', settingsRouter);
router.use('/posts', postRouter);

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
