import type { MessagePermission, VisibilityLevel } from '@prisma/client';

export interface AccountInfoView {
  email: string;
  phone: string | null;
  accountCreatedAt: string;
  lastLoginAt: string | null;
}

export interface SecurityOverviewView {
  twoFactorEnabled: boolean;
  activeSessionCount: number;
  lastPasswordChangeAt: string | null;
  lastLogin: {
    at: string | null;
    location: string | null;
    device: string | null;
  };
}

export interface PrivacySettingsView {
  isPrivate: boolean;
  postsVisibility: VisibilityLevel;
  messagesFrom: MessagePermission;
  followersListVisibility: VisibilityLevel;
  followingListVisibility: VisibilityLevel;
}

export interface SessionView {
  id: string;
  deviceName: string;
  location: string | null;
  ipAddress: string | null;
  isCurrent: boolean;
  lastActiveAt: string;
  createdAt: string;
}

export interface PendingChangeView {
  message: string;
  pendingEmail?: string;
  pendingPhone?: string;
}

export interface UpdateAccountSettingsInput {
  phone?: string | null;
  phoneVerifiedAt?: Date | null;
  pendingEmail?: string | null;
  pendingEmailOtp?: string | null;
  pendingEmailOtpExpiresAt?: Date | null;
  pendingPhone?: string | null;
  pendingPhoneOtp?: string | null;
  pendingPhoneOtpExpiresAt?: Date | null;
  lastPasswordChangeAt?: Date | null;
  lastLoginAt?: Date | null;
  lastLoginLocation?: string | null;
  lastLoginDevice?: string | null;
  twoFactorEnabled?: boolean;
}

export interface CreateSessionInput {
  deviceName: string;
  userAgent?: string;
  ipAddress?: string;
  location?: string;
  isCurrent?: boolean;
}
