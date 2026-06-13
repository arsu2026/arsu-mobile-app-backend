import { prisma } from '../../prisma';
import type { CreateSessionInput, UpdateAccountSettingsInput } from './settings.types';

export async function findProfileById(userId: string) {
  return prisma.profile.findUnique({
    where: { id: userId },
    include: { privacySettings: true, accountSettings: true },
  });
}

export async function ensureAccountSettings(userId: string) {
  return prisma.userAccountSettings.upsert({
    where: { profileId: userId },
    create: { profileId: userId },
    update: {},
  });
}

export async function updateAccountSettings(userId: string, data: UpdateAccountSettingsInput) {
  await ensureAccountSettings(userId);
  return prisma.userAccountSettings.update({
    where: { profileId: userId },
    data,
  });
}

export async function getPrivacySettings(userId: string) {
  return prisma.profilePrivacySettings.findUnique({
    where: { profileId: userId },
  });
}

export async function updatePrivacySettings(
  userId: string,
  data: {
    postsVisibility?: 'PUBLIC' | 'FOLLOWERS' | 'ONLY_ME';
    messagesFrom?: 'EVERYONE' | 'FOLLOWERS' | 'NOBODY';
    isPrivate?: boolean;
    followersListVisibility?: 'PUBLIC' | 'FOLLOWERS' | 'ONLY_ME';
    followingListVisibility?: 'PUBLIC' | 'FOLLOWERS' | 'ONLY_ME';
  },
) {
  return prisma.profilePrivacySettings.upsert({
    where: { profileId: userId },
    create: { profileId: userId, ...data },
    update: data,
  });
}

export async function listUserSessions(userId: string) {
  return prisma.userSession.findMany({
    where: { userId },
    orderBy: { lastActiveAt: 'desc' },
  });
}

export async function countUserSessions(userId: string) {
  return prisma.userSession.count({ where: { userId } });
}

export async function findSessionById(sessionId: string, userId: string) {
  return prisma.userSession.findFirst({
    where: { id: sessionId, userId },
  });
}

export async function deleteSession(sessionId: string, userId: string) {
  return prisma.userSession.deleteMany({
    where: { id: sessionId, userId },
  });
}

export async function createSession(userId: string, input: CreateSessionInput) {
  return prisma.userSession.create({
    data: {
      userId,
      deviceName: input.deviceName,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      location: input.location,
      isCurrent: input.isCurrent ?? false,
    },
  });
}

export async function markCurrentSession(userId: string, sessionId: string) {
  await prisma.userSession.updateMany({
    where: { userId },
    data: { isCurrent: false },
  });
  return prisma.userSession.update({
    where: { id: sessionId },
    data: { isCurrent: true, lastActiveAt: new Date() },
  });
}

export async function upsertCurrentSession(
  userId: string,
  input: CreateSessionInput,
) {
  const existing = await prisma.userSession.findFirst({
    where: { userId, isCurrent: true },
  });

  if (existing) {
    return prisma.userSession.update({
      where: { id: existing.id },
      data: {
        deviceName: input.deviceName,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
        location: input.location,
        lastActiveAt: new Date(),
      },
    });
  }

  return createSession(userId, { ...input, isCurrent: true });
}
