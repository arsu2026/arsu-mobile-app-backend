jest.mock('./settings.repository');
jest.mock('../../config/supabase.config');

import { supabaseClient, supabaseAdmin } from '../../config/supabase.config';
import * as repo from './settings.repository';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../../common/errors';
import {
  changePassword,
  getAccountInfo,
  getPrivacySettings,
  revokeSession,
  updateMessagePrivacy,
  verifyEmailChange,
} from './settings.service';

const mockFindProfileById = repo.findProfileById as jest.Mock;
const mockEnsureAccountSettings = repo.ensureAccountSettings as jest.Mock;
const mockUpdateAccountSettings = repo.updateAccountSettings as jest.Mock;
const mockGetPrivacySettings = repo.getPrivacySettings as jest.Mock;
const mockUpdatePrivacySettings = repo.updatePrivacySettings as jest.Mock;
const mockFindSessionById = repo.findSessionById as jest.Mock;
const mockDeleteSession = repo.deleteSession as jest.Mock;
const mockSignInWithPassword = supabaseClient.auth.signInWithPassword as jest.Mock;
const mockUpdateUserById = supabaseAdmin.auth.admin.updateUserById as jest.Mock;

const USER_A = '11111111-1111-4111-8111-111111111111';

const baseProfile = {
  id: USER_A,
  createdAt: new Date('2024-01-01'),
  accountSettings: {
    phone: '+15551234567',
    phoneVerifiedAt: new Date('2024-01-01'),
    pendingEmail: null,
    pendingEmailOtp: null,
    pendingEmailOtpExpiresAt: null,
    lastLoginAt: new Date('2024-06-01'),
    lastPasswordChangeAt: null,
    twoFactorEnabled: false,
    lastLoginLocation: 'New York, US',
    lastLoginDevice: 'Chrome',
  },
  privacySettings: {
    isPrivate: false,
    postsVisibility: 'PUBLIC',
    messagesFrom: 'EVERYONE',
    followersListVisibility: 'PUBLIC',
    followingListVisibility: 'PUBLIC',
  },
};

describe('settings.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindProfileById.mockResolvedValue(baseProfile);
    mockEnsureAccountSettings.mockResolvedValue(baseProfile.accountSettings);
  });

  describe('changePassword', () => {
    it('updates password when current password is correct', async () => {
      mockSignInWithPassword.mockResolvedValue({ error: null });
      mockUpdateUserById.mockResolvedValue({ error: null });
      mockUpdateAccountSettings.mockResolvedValue({});

      const result = await changePassword(USER_A, 'user@example.com', 'oldpass12', 'newpass12');

      expect(result.message).toBe('Password updated successfully');
      expect(mockUpdateAccountSettings).toHaveBeenCalled();
    });

    it('throws UnauthorizedError when current password is wrong', async () => {
      mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid' } });

      await expect(
        changePassword(USER_A, 'user@example.com', 'wrong', 'newpass12'),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  describe('verifyEmailChange', () => {
    it('confirms email change with valid OTP', async () => {
      mockFindProfileById.mockResolvedValue({
        ...baseProfile,
        accountSettings: {
          ...baseProfile.accountSettings,
          pendingEmail: 'new@example.com',
          pendingEmailOtp: '123456',
          pendingEmailOtpExpiresAt: new Date(Date.now() + 60000),
        },
      });
      mockUpdateUserById.mockResolvedValue({ error: null });
      mockUpdateAccountSettings.mockResolvedValue({});

      const result = await verifyEmailChange(USER_A, '123456');

      expect(result.email).toBe('new@example.com');
    });

    it('throws BadRequestError for invalid OTP', async () => {
      mockFindProfileById.mockResolvedValue({
        ...baseProfile,
        accountSettings: {
          ...baseProfile.accountSettings,
          pendingEmail: 'new@example.com',
          pendingEmailOtp: '123456',
          pendingEmailOtpExpiresAt: new Date(Date.now() + 60000),
        },
      });

      await expect(verifyEmailChange(USER_A, '000000')).rejects.toBeInstanceOf(BadRequestError);
    });
  });

  describe('getAccountInfo', () => {
    it('returns masked phone and account details', async () => {
      const result = await getAccountInfo(USER_A, 'user@example.com');

      expect(result.email).toBe('user@example.com');
      expect(result.phone).toBe('***-***-4567');
      expect(result.accountCreatedAt).toBeDefined();
    });
  });

  describe('getPrivacySettings', () => {
    it('returns full privacy config', async () => {
      mockGetPrivacySettings.mockResolvedValue(baseProfile.privacySettings);

      const result = await getPrivacySettings(USER_A);

      expect(result.isPrivate).toBe(false);
      expect(result.postsVisibility).toBe('PUBLIC');
    });
  });

  describe('updateMessagePrivacy', () => {
    it('updates message permission', async () => {
      mockUpdatePrivacySettings.mockResolvedValue({
        ...baseProfile.privacySettings,
        messagesFrom: 'FOLLOWERS',
      });

      const result = await updateMessagePrivacy(USER_A, 'FOLLOWERS');

      expect(result.messagesFrom).toBe('FOLLOWERS');
    });
  });

  describe('revokeSession', () => {
    it('throws BadRequestError when revoking current session', async () => {
      mockFindSessionById.mockResolvedValue({
        id: 'sess-1',
        isCurrent: true,
      });

      await expect(revokeSession(USER_A, 'sess-1')).rejects.toBeInstanceOf(BadRequestError);
      expect(mockDeleteSession).not.toHaveBeenCalled();
    });

    it('revokes non-current session', async () => {
      mockFindSessionById.mockResolvedValue({
        id: 'sess-2',
        isCurrent: false,
      });
      mockDeleteSession.mockResolvedValue({ count: 1 });

      const result = await revokeSession(USER_A, 'sess-2');

      expect(result.message).toBe('Session revoked successfully');
    });

    it('throws NotFoundError for unknown session', async () => {
      mockFindSessionById.mockResolvedValue(null);

      await expect(revokeSession(USER_A, 'missing')).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
