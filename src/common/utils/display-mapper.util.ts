import type { Gender, PostPrivacy, VisibilityLevel } from '@prisma/client';

const GENDER_LABELS: Record<Gender, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  NON_BINARY: 'Non-binary',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
  OTHER: 'Other',
};

const PRIVACY_LABELS: Record<PostPrivacy, string> = {
  PUBLIC: 'Public',
  FOLLOWERS: 'Friends',
  ONLY_ME: 'Only Me',
};

const VISIBILITY_LABELS: Record<VisibilityLevel, string> = {
  PUBLIC: 'Public',
  FOLLOWERS: 'Friends',
  ONLY_ME: 'Only Me',
};

export function splitFullName(fullName: string | null | undefined): {
  firstName: string | null;
  lastName: string | null;
} {
  if (!fullName?.trim()) return { firstName: null, lastName: null };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function joinFullName(firstName?: string, lastName?: string): string | undefined {
  const parts = [firstName?.trim(), lastName?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

export function mapGenderLabel(gender: Gender | null | undefined): string | null {
  if (!gender) return null;
  return GENDER_LABELS[gender];
}

export function mapPrivacyLabel(privacy: PostPrivacy): string {
  return PRIVACY_LABELS[privacy];
}

export function mapVisibilityLabel(visibility: VisibilityLevel): string {
  return VISIBILITY_LABELS[visibility];
}
