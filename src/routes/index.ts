import { Router } from 'express';
import { activityLogRouter } from '../modules/activity-log/activity-log.routes';
import { adminAuthRouter } from '../modules/admin/auth/admin-auth.routes';
import { authRouter } from '../modules/auth/auth.routes';
import { contactsRouter } from '../modules/contacts/contacts.routes';
import { feedRouter } from '../modules/feed/feed.routes';
import { mediaRouter } from '../modules/media/media.routes';
import { memoriesRouter } from '../modules/memories/memories.routes';
import { notificationRouter } from '../modules/notification/notification.routes';
import { postRouter } from '../modules/post/post.routes';
import { profileRouter } from '../modules/profile/profile.routes';
import { savedRouter } from '../modules/saved/saved.routes';
import { searchRouter } from '../modules/search/search.routes';
import { settingsRouter } from '../modules/settings/settings.routes';
import { supportRouter } from '../modules/support/support.routes';

// ─────────────────────────────────────────────────────────────────────────────
// Root API Router
// ─────────────────────────────────────────────────────────────────────────────
// Import and mount feature module routers here as you build them.
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();

// ── Feature Modules ───────────────────────────────────────────────────────────
router.use('/admin/auth', adminAuthRouter);
router.use('/auth', authRouter);
router.use('/profile', profileRouter);
router.use('/feed', feedRouter);
router.use('/media', mediaRouter);
router.use('/search', searchRouter);
router.use('/settings', settingsRouter);
router.use('/posts', postRouter);
router.use('/notifications', notificationRouter);
router.use('/saved', savedRouter);
router.use('/memories', memoriesRouter);
router.use('/activity-log', activityLogRouter);
router.use('/contacts', contactsRouter);
router.use('/support', supportRouter);

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
