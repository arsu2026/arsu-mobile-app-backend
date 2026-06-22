import { prisma } from '../../prisma';

export async function findVerifiedProfilesByPhones(phones: string[]) {
  if (phones.length === 0) return [];
  return prisma.userAccountSettings.findMany({
    where: { phone: { in: phones }, phoneVerifiedAt: { not: null } },
    select: {
      phone: true,
      profile: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
    },
  });
}

export async function addContacts(userId: string, contactUserIds: string[]) {
  if (contactUserIds.length === 0) return { count: 0 };
  return prisma.userContact.createMany({
    data: contactUserIds.map((contactUserId) => ({ userId, contactUserId })),
    skipDuplicates: true,
  });
}
