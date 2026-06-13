import { Router } from 'express';
import { supabaseAuthGuard } from '../../common/guards';
import { validateBody } from '../../common/middleware/validate.middleware';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangePhoneDto } from './dto/change-phone.dto';
import { UpdateMessagePrivacyDto } from './dto/update-message-privacy.dto';
import { UpdatePostPrivacyDto } from './dto/update-post-privacy.dto';
import { VerifyEmailChangeDto } from './dto/verify-email-change.dto';
import * as settingsController from './settings.controller';

// ─────────────────────────────────────────────────────────────────────────────
// Settings Routes — mounted at /api/v1/settings
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();

router.put('/password', supabaseAuthGuard, validateBody(ChangePasswordDto), settingsController.changePassword);
router.put('/email', supabaseAuthGuard, validateBody(ChangeEmailDto), settingsController.changeEmail);
router.put('/email/verify', supabaseAuthGuard, validateBody(VerifyEmailChangeDto), settingsController.verifyEmailChange);
router.put('/phone', supabaseAuthGuard, validateBody(ChangePhoneDto), settingsController.changePhone);
router.put('/phone/verify', supabaseAuthGuard, validateBody(VerifyEmailChangeDto), settingsController.verifyPhoneChange);

router.get('/account', supabaseAuthGuard, settingsController.getAccountInfo);
router.get('/security', supabaseAuthGuard, settingsController.getSecurityOverview);

router.get('/privacy', supabaseAuthGuard, settingsController.getPrivacySettings);
router.put('/privacy/posts', supabaseAuthGuard, validateBody(UpdatePostPrivacyDto), settingsController.updatePostDefaultVisibility);
router.put('/privacy/messages', supabaseAuthGuard, validateBody(UpdateMessagePrivacyDto), settingsController.updateMessagePrivacy);

router.get('/sessions', supabaseAuthGuard, settingsController.getActiveSessions);
router.delete('/sessions/:sessionId', supabaseAuthGuard, settingsController.revokeSession);

export { router as settingsRouter };
