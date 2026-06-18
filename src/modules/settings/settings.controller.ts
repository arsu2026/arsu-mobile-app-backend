import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../common/errors';
import { sendSuccess } from '../../common/utils/response.util';
import type { ChangeEmailDto } from './dto/change-email.dto';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { ChangePhoneDto } from './dto/change-phone.dto';
import type { UpdateMessagePrivacyDto } from './dto/update-message-privacy.dto';
import type { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import type { UpdatePostPrivacyDto } from './dto/update-post-privacy.dto';
import type { VerifyEmailChangeDto } from './dto/verify-email-change.dto';
import type { VerifyTwoFactorDto } from './dto/verify-two-factor.dto';
import type { DisableTwoFactorDto } from './dto/disable-two-factor.dto';
import * as notificationService from '../notification/notification.service';
import * as settingsService from './settings.service';

function requireUser(req: Request): { userId: string; email: string } {
  if (!req.user?.sub || !req.user.email) {
    throw new UnauthorizedError('Authentication required');
  }
  return { userId: req.user.sub, email: req.user.email };
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

function parseDeviceHint(req: Request) {
  const userAgent = req.headers['user-agent'];
  return {
    deviceName: typeof userAgent === 'string' ? userAgent.slice(0, 100) : 'Unknown device',
    userAgent: typeof userAgent === 'string' ? userAgent : undefined,
    ipAddress: req.ip,
  };
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const { userId, email } = requireUser(req);
  const body = req.body as ChangePasswordDto;
  const result = await settingsService.changePassword(
    userId,
    email,
    body.currentPassword,
    body.newPassword,
  );
  sendSuccess(res, result, { message: result.message });
}

export async function changeEmail(req: Request, res: Response): Promise<void> {
  const { userId, email } = requireUser(req);
  const body = req.body as ChangeEmailDto;
  const result = await settingsService.changeEmail(userId, email, body.newEmail);
  sendSuccess(res, result, { message: result.message });
}

export async function verifyEmailChange(req: Request, res: Response): Promise<void> {
  const { userId } = requireUser(req);
  const body = req.body as VerifyEmailChangeDto;
  const result = await settingsService.verifyEmailChange(userId, body.otp);
  sendSuccess(res, result, { message: result.message });
}

export async function changePhone(req: Request, res: Response): Promise<void> {
  const { userId } = requireUser(req);
  const body = req.body as ChangePhoneDto;
  const result = await settingsService.changePhone(userId, body.newPhone);
  sendSuccess(res, result, { message: result.message });
}

export async function verifyPhoneChange(req: Request, res: Response): Promise<void> {
  const { userId } = requireUser(req);
  const body = req.body as VerifyEmailChangeDto;
  const result = await settingsService.verifyPhoneChange(userId, body.otp);
  sendSuccess(res, result, { message: result.message });
}

export async function getAccountInfo(req: Request, res: Response): Promise<void> {
  const { userId, email } = requireUser(req);
  const info = await settingsService.getAccountInfo(userId, email);
  sendSuccess(res, info);
}

export async function getPrivacySettings(req: Request, res: Response): Promise<void> {
  const { userId } = requireUser(req);
  const settings = await settingsService.getPrivacySettings(userId);
  sendSuccess(res, settings);
}

export async function updatePostDefaultVisibility(req: Request, res: Response): Promise<void> {
  const { userId } = requireUser(req);
  const body = req.body as UpdatePostPrivacyDto;
  const settings = await settingsService.updatePostDefaultVisibility(userId, body.postsVisibility);
  sendSuccess(res, settings, { message: 'Default post visibility updated' });
}

export async function updateMessagePrivacy(req: Request, res: Response): Promise<void> {
  const { userId } = requireUser(req);
  const body = req.body as UpdateMessagePrivacyDto;
  const settings = await settingsService.updateMessagePrivacy(userId, body.messagesFrom);
  sendSuccess(res, settings, { message: 'Message privacy updated' });
}

export async function getSecurityOverview(req: Request, res: Response): Promise<void> {
  const { userId } = requireUser(req);
  const overview = await settingsService.getSecurityOverview(userId);
  sendSuccess(res, overview);
}

export async function getActiveSessions(req: Request, res: Response): Promise<void> {
  const { userId } = requireUser(req);
  const sessions = await settingsService.getActiveSessions(userId, parseDeviceHint(req));
  sendSuccess(res, sessions);
}

export async function revokeSession(req: Request, res: Response): Promise<void> {
  const { userId } = requireUser(req);
  const result = await settingsService.revokeSession(userId, param(req, 'sessionId'));
  sendSuccess(res, result, { message: result.message });
}

export async function enableTwoFactor(req: Request, res: Response): Promise<void> {
  const { userId } = requireUser(req);
  const result = await settingsService.enableTwoFactor(userId);
  sendSuccess(res, result, { message: result.message });
}

export async function verifyTwoFactor(req: Request, res: Response): Promise<void> {
  const { userId } = requireUser(req);
  const body = req.body as VerifyTwoFactorDto;
  const result = await settingsService.verifyTwoFactor(userId, body.code);
  sendSuccess(res, result, { message: result.message });
}

export async function disableTwoFactor(req: Request, res: Response): Promise<void> {
  const { userId, email } = requireUser(req);
  const body = req.body as DisableTwoFactorDto;
  const result = await settingsService.disableTwoFactor(userId, email, body.password);
  sendSuccess(res, result, { message: result.message });
}

export async function getNotificationPreferences(req: Request, res: Response): Promise<void> {
  const { userId } = requireUser(req);
  const prefs = await notificationService.getPreferences(userId);
  sendSuccess(res, prefs);
}

export async function updateNotificationPreferences(req: Request, res: Response): Promise<void> {
  const { userId } = requireUser(req);
  const body = req.body as UpdateNotificationPreferencesDto;
  const prefs = await notificationService.updatePreferences(userId, body);
  sendSuccess(res, prefs, { message: 'Notification preferences updated' });
}
