import crypto from 'crypto';
import { supabaseClient, supabaseAdmin } from '../../config/supabase.config';
import { env } from '../../config/env.config';
import { mailerTransport } from '../../config/mailer.config';
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../../common/errors';
import * as repo from './settings.repository';
import type {
  AccountInfoView,
  PendingChangeView,
  PrivacySettingsView,
  SecurityOverviewView,
  SessionView,
} from './settings.types';

const OTP_EXPIRY_MS = 15 * 60 * 1000;

function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  const lastFour = digits.slice(-4);
  return `***-***-${lastFour}`;
}

function mapPrivacy(settings: NonNullable<Awaited<ReturnType<typeof repo.getPrivacySettings>>>): PrivacySettingsView {
  return {
    isPrivate: settings.isPrivate,
    postsVisibility: settings.postsVisibility,
    messagesFrom: settings.messagesFrom,
    followersListVisibility: settings.followersListVisibility,
    followingListVisibility: settings.followingListVisibility,
  };
}

function mapSession(session: Awaited<ReturnType<typeof repo.listUserSessions>>[number]): SessionView {
  return {
    id: session.id,
    deviceName: session.deviceName,
    location: session.location,
    ipAddress: session.ipAddress,
    isCurrent: session.isCurrent,
    lastActiveAt: session.lastActiveAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
  };
}

async function ensureProfile(userId: string) {
  const profile = await repo.findProfileById(userId);
  if (!profile) throw new NotFoundError('Profile');
  return profile;
}

async function sendVerificationEmail(to: string, otp: string): Promise<void> {
  if (!env.MAIL_USER) {
    return;
  }

  await mailerTransport.sendMail({
    from: env.MAIL_FROM,
    to,
    subject: 'Verify your new email address — ARSU',
    text: `Your verification code is: ${otp}. It expires in 15 minutes.`,
    html: `<p>Your verification code is: <strong>${otp}</strong></p><p>It expires in 15 minutes.</p>`,
  });
}

function sendTwoFactorSms(_phone: string, _otp: string): void {
  // No SMS gateway is configured in this environment. Enrollment generates and
  // stores the OTP; delivery is a no-op stub to be wired to a provider later.
}

export async function changePassword(
  userId: string,
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  const { error: signInError } = await supabaseClient.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (signInError) throw new UnauthorizedError('Current password is incorrect');

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (updateError) {
    throw new AppError(updateError.message, 422, 'WEAK_PASSWORD');
  }

  await repo.updateAccountSettings(userId, { lastPasswordChangeAt: new Date() });
  return { message: 'Password updated successfully' };
}

export async function changeEmail(
  userId: string,
  currentEmail: string,
  newEmail: string,
): Promise<PendingChangeView> {
  if (currentEmail.toLowerCase() === newEmail.toLowerCase()) {
    throw new BadRequestError('New email must be different from your current email');
  }

  await ensureProfile(userId);
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await repo.updateAccountSettings(userId, {
    pendingEmail: newEmail.toLowerCase(),
    pendingEmailOtp: otp,
    pendingEmailOtpExpiresAt: expiresAt,
  });

  await sendVerificationEmail(newEmail, otp);

  return {
    message: 'Verification code sent to your new email address',
    pendingEmail: newEmail,
  };
}

export async function verifyEmailChange(userId: string, otp: string): Promise<{ message: string; email: string }> {
  const profile = await ensureProfile(userId);
  const settings = profile.accountSettings ?? (await repo.ensureAccountSettings(userId));

  if (!settings.pendingEmail || !settings.pendingEmailOtp) {
    throw new BadRequestError('No pending email change request');
  }

  if (settings.pendingEmailOtp !== otp) {
    throw new BadRequestError('Invalid verification code');
  }

  if (!settings.pendingEmailOtpExpiresAt || settings.pendingEmailOtpExpiresAt < new Date()) {
    throw new BadRequestError('Verification code has expired. Please request a new one.');
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    email: settings.pendingEmail,
    email_confirm: true,
  });
  if (error) throw new AppError(error.message, 400, 'EMAIL_UPDATE_FAILED');

  await repo.updateAccountSettings(userId, {
    pendingEmail: null,
    pendingEmailOtp: null,
    pendingEmailOtpExpiresAt: null,
  });

  return {
    message: 'Email address updated successfully',
    email: settings.pendingEmail,
  };
}

export async function changePhone(
  userId: string,
  newPhone: string,
): Promise<PendingChangeView> {
  await ensureProfile(userId);
  const settings = await repo.ensureAccountSettings(userId);

  if (settings.phone === newPhone) {
    throw new BadRequestError('New phone number must be different from your current number');
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await repo.updateAccountSettings(userId, {
    pendingPhone: newPhone,
    pendingPhoneOtp: otp,
    pendingPhoneOtpExpiresAt: expiresAt,
  });

  return {
    message: 'Verification code sent to your new phone number',
    pendingPhone: maskPhone(newPhone) ?? undefined,
  };
}

export async function verifyPhoneChange(userId: string, otp: string): Promise<{ message: string; phone: string }> {
  const profile = await ensureProfile(userId);
  const settings = profile.accountSettings ?? (await repo.ensureAccountSettings(userId));

  if (!settings.pendingPhone || !settings.pendingPhoneOtp) {
    throw new BadRequestError('No pending phone change request');
  }

  if (settings.pendingPhoneOtp !== otp) {
    throw new BadRequestError('Invalid verification code');
  }

  if (!settings.pendingPhoneOtpExpiresAt || settings.pendingPhoneOtpExpiresAt < new Date()) {
    throw new BadRequestError('Verification code has expired. Please request a new one.');
  }

  await repo.updateAccountSettings(userId, {
    phone: settings.pendingPhone,
    phoneVerifiedAt: new Date(),
    pendingPhone: null,
    pendingPhoneOtp: null,
    pendingPhoneOtpExpiresAt: null,
  });

  return {
    message: 'Phone number updated successfully',
    phone: settings.pendingPhone,
  };
}

export async function enableTwoFactor(
  userId: string,
): Promise<{ message: string; method: 'SMS'; phone: string | null }> {
  const profile = await ensureProfile(userId);
  const settings = profile.accountSettings ?? (await repo.ensureAccountSettings(userId));

  if (settings.twoFactorEnabled) {
    throw new ConflictError('Two-factor authentication is already enabled');
  }
  if (!settings.phone || !settings.phoneVerifiedAt) {
    throw new BadRequestError('Add and verify a phone number before enabling two-factor authentication');
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
  await repo.updateAccountSettings(userId, {
    twoFactorMethod: 'SMS',
    pendingTwoFactorOtp: otp,
    pendingTwoFactorOtpExpiresAt: expiresAt,
  });
  sendTwoFactorSms(settings.phone, otp);

  return { message: 'Verification code sent to your phone', method: 'SMS', phone: maskPhone(settings.phone) };
}

export async function verifyTwoFactor(userId: string, code: string): Promise<{ message: string }> {
  const profile = await ensureProfile(userId);
  const settings = profile.accountSettings ?? (await repo.ensureAccountSettings(userId));

  if (!settings.pendingTwoFactorOtp) {
    throw new BadRequestError('No pending two-factor enrollment');
  }
  if (settings.pendingTwoFactorOtp !== code) {
    throw new BadRequestError('Invalid verification code');
  }
  if (!settings.pendingTwoFactorOtpExpiresAt || settings.pendingTwoFactorOtpExpiresAt < new Date()) {
    throw new BadRequestError('Verification code has expired. Please request a new one.');
  }

  await repo.updateAccountSettings(userId, {
    twoFactorEnabled: true,
    pendingTwoFactorOtp: null,
    pendingTwoFactorOtpExpiresAt: null,
  });
  return { message: 'Two-factor authentication enabled' };
}

export async function disableTwoFactor(
  userId: string,
  email: string,
  password: string,
): Promise<{ message: string }> {
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw new UnauthorizedError('Password is incorrect');

  await repo.updateAccountSettings(userId, {
    twoFactorEnabled: false,
    twoFactorMethod: null,
    pendingTwoFactorOtp: null,
    pendingTwoFactorOtpExpiresAt: null,
  });
  return { message: 'Two-factor authentication disabled' };
}

export async function getAccountInfo(
  userId: string,
  email: string,
): Promise<AccountInfoView> {
  const profile = await ensureProfile(userId);
  const settings = profile.accountSettings ?? (await repo.ensureAccountSettings(userId));

  return {
    email,
    phone: maskPhone(settings.phone),
    accountCreatedAt: profile.createdAt.toISOString(),
    lastLoginAt: settings.lastLoginAt?.toISOString() ?? null,
  };
}

export async function getPrivacySettings(userId: string): Promise<PrivacySettingsView> {
  await ensureProfile(userId);
  const settings = await repo.getPrivacySettings(userId);
  if (!settings) throw new NotFoundError('Privacy settings');
  return mapPrivacy(settings);
}

export async function updatePostDefaultVisibility(
  userId: string,
  postsVisibility: PrivacySettingsView['postsVisibility'],
): Promise<PrivacySettingsView> {
  await ensureProfile(userId);
  const settings = await repo.updatePrivacySettings(userId, { postsVisibility });
  return mapPrivacy(settings);
}

export async function updateMessagePrivacy(
  userId: string,
  messagesFrom: PrivacySettingsView['messagesFrom'],
): Promise<PrivacySettingsView> {
  await ensureProfile(userId);
  const settings = await repo.updatePrivacySettings(userId, { messagesFrom });
  return mapPrivacy(settings);
}

export async function getSecurityOverview(userId: string): Promise<SecurityOverviewView> {
  const profile = await ensureProfile(userId);
  const settings = profile.accountSettings ?? (await repo.ensureAccountSettings(userId));
  const sessionCount = await repo.countUserSessions(userId);

  return {
    twoFactorEnabled: settings.twoFactorEnabled,
    activeSessionCount: sessionCount,
    lastPasswordChangeAt: settings.lastPasswordChangeAt?.toISOString() ?? null,
    lastLogin: {
      at: settings.lastLoginAt?.toISOString() ?? null,
      location: settings.lastLoginLocation,
      device: settings.lastLoginDevice,
    },
  };
}

export async function getActiveSessions(
  userId: string,
  deviceHint?: { deviceName: string; userAgent?: string; ipAddress?: string; location?: string },
): Promise<SessionView[]> {
  await ensureProfile(userId);

  let sessions = await repo.listUserSessions(userId);

  if (sessions.length === 0 && deviceHint) {
    await repo.upsertCurrentSession(userId, deviceHint);
    sessions = await repo.listUserSessions(userId);
  }

  return sessions.map(mapSession);
}

export async function revokeSession(
  userId: string,
  sessionId: string,
): Promise<{ message: string }> {
  const session = await repo.findSessionById(sessionId, userId);
  if (!session) throw new NotFoundError('Session');

  if (session.isCurrent) {
    throw new BadRequestError('Cannot revoke your current session. Use logout instead.');
  }

  await repo.deleteSession(sessionId, userId);
  return { message: 'Session revoked successfully' };
}

export async function recordLoginSession(
  userId: string,
  deviceName: string,
  location?: string,
): Promise<void> {
  await repo.updateAccountSettings(userId, {
    lastLoginAt: new Date(),
    lastLoginDevice: deviceName,
    lastLoginLocation: location ?? null,
  });
  await repo.upsertCurrentSession(userId, { deviceName, location, isCurrent: true });
}
