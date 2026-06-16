import type { FollowStatus, PostPrivacy, VisibilityLevel } from '@prisma/client';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors';
import { buildPaginationMeta } from '../../common/utils/response.util';
import type { PaginationMeta } from '../../common/utils/response.util';
import * as repo from './profile.repository';
import type {
  BasicUserInfo,
  FollowRequestView,
  FriendCardUser,
  PostView,
  PrivacySettingsView,
  ProfileIntro,
  ProfileView,
  UpdateIntroInput,
  UpdatePrivacyInput,
  UpdateProfileInput,
  UserSuggestion,
} from './profile.types';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertValidUserId(userId: string): void {
  if (!UUID_REGEX.test(userId)) {
    throw new BadRequestError('Invalid user ID format');
  }
}

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

function toPresence(lastActiveAt: Date | null): { isOnline: boolean; lastSeen: string | null } {
  if (!lastActiveAt) return { isOnline: false, lastSeen: null };
  return {
    isOnline: Date.now() - lastActiveAt.getTime() < ONLINE_THRESHOLD_MS,
    lastSeen: lastActiveAt.toISOString(),
  };
}

function toFriendCardUser(
  user: {
    id: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    lastActiveAt: Date | null;
  },
  isFollowing: boolean,
): FriendCardUser {
  const presence = toPresence(user.lastActiveAt);
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    isFollowing,
    isOnline: presence.isOnline,
    // The exact last-seen timestamp is only disclosed to accounts the viewer
    // follows. Non-connections (e.g. suggestion cards) get the online flag but
    // not the precise activity schedule, which would otherwise be harvestable.
    lastSeen: isFollowing ? presence.lastSeen : null,
  };
}

async function ensureProfileExists(userId: string) {
  const profile = await repo.findProfileById(userId);
  if (!profile) throw new NotFoundError('Profile');
  return profile;
}

async function ensureNotBlocked(viewerId: string | undefined, targetId: string) {
  if (!viewerId || viewerId === targetId) return;
  const block = await repo.findBlockBetween(viewerId, targetId);
  if (block) throw new NotFoundError('Profile');
}

async function ensureCanViewProfile(viewerId: string | undefined, targetId: string) {
  const profile = await ensureProfileExists(targetId);
  await ensureNotBlocked(viewerId, targetId);

  const isPrivate = profile.privacySettings?.isPrivate ?? false;
  if (!isPrivate) return profile;
  if (viewerId === targetId) return profile;

  if (!viewerId) throw new NotFoundError('Profile');

  const follow = await repo.findFollow(viewerId, targetId);
  if (follow?.status !== 'ACCEPTED') throw new NotFoundError('Profile');

  return profile;
}

function canViewList(
  visibility: VisibilityLevel,
  isOwner: boolean,
  isFollower: boolean,
): boolean {
  if (isOwner) return true;
  if (visibility === 'PUBLIC') return true;
  if (visibility === 'FOLLOWERS') return isFollower;
  return false;
}

function buildPostPrivacyFilter(
  viewerId: string | undefined,
  ownerId: string,
  isFollower: boolean,
  defaultVisibility: VisibilityLevel,
): { OR: Array<{ privacy: PostPrivacy } | { privacy: { in: PostPrivacy[] } }> } | Record<string, never> {
  const isOwner = viewerId === ownerId;

  if (isOwner) return {};

  const allowed: PostPrivacy[] = ['PUBLIC'];
  if (isFollower) allowed.push('FOLLOWERS');
  if (defaultVisibility === 'PUBLIC') {
    return { OR: [{ privacy: { in: allowed } }] };
  }
  if (defaultVisibility === 'FOLLOWERS' && isFollower) {
    return { OR: [{ privacy: { in: allowed } }] };
  }
  if (defaultVisibility === 'FOLLOWERS' && !isFollower) {
    return { OR: [{ privacy: 'PUBLIC' }] };
  }
  return { OR: [{ privacy: 'PUBLIC' }] };
}

function mapPost(post: Awaited<ReturnType<typeof repo.findPostById>>): PostView {
  if (!post) throw new NotFoundError('Post');
  return {
    id: post.id,
    authorId: post.authorId,
    content: post.content,
    postType: post.postType,
    privacy: post.privacy,
    mediaUrl: post.mediaUrl,
    thumbnailUrl: post.thumbnailUrl,
    isLongFormVideo: post.isLongFormVideo,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

async function mapBasicUsers(
  viewerId: string | undefined,
  users: Array<{
    id: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
  }>,
  includeFollowingBack = false,
): Promise<BasicUserInfo[]> {
  const ids = users.map((u) => u.id);
  const followingIds = viewerId ? await repo.findFollowingIds(viewerId, ids) : [];
  const followingBackIds =
    includeFollowingBack && viewerId
      ? await repo.findFollowerIdsOfTargets(viewerId, ids)
      : [];

  return users.map((user) => ({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    isFollowing: followingIds.includes(user.id),
    ...(includeFollowingBack && {
      isFollowingBack: followingBackIds.includes(user.id),
    }),
  }));
}

export async function getProfile(
  userId: string,
  viewerId?: string,
): Promise<ProfileView> {
  assertValidUserId(userId);
  const profile = await ensureCanViewProfile(viewerId, userId);

  const [followerCount, followingCount, postCount] = await Promise.all([
    repo.countFollowers(userId),
    repo.countFollowing(userId),
    repo.countPosts(userId),
  ]);

  let isFollowing = false;
  let followStatus: FollowStatus | null = null;
  if (viewerId && viewerId !== userId) {
    const follow = await repo.findFollow(viewerId, userId);
    if (follow) {
      followStatus = follow.status;
      isFollowing = follow.status === 'ACCEPTED';
    }
  }

  return {
    id: profile.id,
    username: profile.username,
    fullName: profile.fullName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    coverUrl: profile.coverUrl,
    website: profile.website,
    dateOfBirth: profile.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    gender: profile.gender,
    relationshipStatus: profile.relationshipStatus,
    location: profile.location,
    followerCount,
    followingCount,
    postCount,
    isFollowing,
    isOwnProfile: viewerId === userId,
    isPrivate: profile.privacySettings?.isPrivate ?? false,
    followStatus,
  };
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<ProfileView> {
  assertValidUserId(userId);
  await ensureProfileExists(userId);

  if (input.username) {
    const conflict = await repo.findUsernameConflict(input.username, userId);
    if (conflict) throw new ConflictError('Username is already taken');
  }

  await repo.updateProfile(userId, input);
  return getProfile(userId, userId);
}

export async function uploadCoverPhoto(
  userId: string,
  coverUrl: string,
): Promise<{ coverUrl: string; post: PostView }> {
  assertValidUserId(userId);
  await ensureProfileExists(userId);

  await repo.updateCoverUrl(userId, coverUrl);

  const post = await repo.createPost({
    author: { connect: { id: userId } },
    content: 'Updated their cover photo',
    postType: 'COVER_PHOTO',
    privacy: 'PUBLIC',
    mediaUrl: coverUrl,
  });

  return { coverUrl, post: mapPost(post) };
}

export async function getUserPosts(
  userId: string,
  viewerId: string | undefined,
  page: number,
  limit: number,
): Promise<{ posts: PostView[]; meta: PaginationMeta }> {
  assertValidUserId(userId);
  const profile = await ensureCanViewProfile(viewerId, userId);

  const isFollower =
    viewerId && viewerId !== userId
      ? await repo.isAcceptedFollower(viewerId, userId)
      : viewerId === userId;

  const privacyFilter = buildPostPrivacyFilter(
    viewerId,
    userId,
    !!isFollower,
    profile.privacySettings?.postsVisibility ?? 'PUBLIC',
  );

  const skip = (page - 1) * limit;
  const { rows, total } = await repo.listPosts(userId, privacyFilter, skip, limit);

  return {
    posts: rows.map((p) => mapPost(p)),
    meta: buildPaginationMeta(total, page, limit),
  };
}

export async function getUserVideos(
  userId: string,
  viewerId: string | undefined,
  page: number,
  limit: number,
): Promise<{ videos: PostView[]; meta: PaginationMeta }> {
  assertValidUserId(userId);
  const profile = await ensureCanViewProfile(viewerId, userId);

  const isFollower =
    viewerId && viewerId !== userId
      ? await repo.isAcceptedFollower(viewerId, userId)
      : viewerId === userId;

  const privacyFilter = {
    ...buildPostPrivacyFilter(
      viewerId,
      userId,
      !!isFollower,
      profile.privacySettings?.postsVisibility ?? 'PUBLIC',
    ),
    isLongFormVideo: true,
    postType: 'VIDEO' as const,
  };

  const skip = (page - 1) * limit;
  const { rows, total } = await repo.listPosts(userId, privacyFilter, skip, limit);

  return {
    videos: rows.map((p) => mapPost(p)),
    meta: buildPaginationMeta(total, page, limit),
  };
}

export async function followUser(actorId: string, targetId: string) {
  assertValidUserId(targetId);
  if (actorId === targetId) throw new BadRequestError('You cannot follow yourself');

  await ensureProfileExists(actorId);
  const target = await ensureProfileExists(targetId);

  const block = await repo.findBlockBetween(actorId, targetId);
  if (block) throw new ForbiddenError('Cannot follow this user');

  const existing = await repo.findFollow(actorId, targetId);
  if (existing) {
    if (existing.status === 'ACCEPTED') throw new ConflictError('Already following this user');
    throw new ConflictError('Follow request already pending');
  }

  const isPrivate = target.privacySettings?.isPrivate ?? false;
  const status = isPrivate ? 'PENDING' : 'ACCEPTED';

  const follow = await repo.createFollow(actorId, targetId, status);

  await repo.createNotification({
    recipientId: targetId,
    actorId,
    type: isPrivate ? 'FOLLOW_REQUEST' : 'FOLLOW',
    entityId: follow.id,
    message: isPrivate
      ? 'sent you a follow request'
      : 'started following you',
  });

  return {
    status: follow.status,
    message: isPrivate ? 'Follow request sent' : 'Now following user',
  };
}

export async function unfollowUser(actorId: string, targetId: string) {
  assertValidUserId(targetId);
  if (actorId === targetId) throw new BadRequestError('Invalid operation');

  const existing = await repo.findFollow(actorId, targetId);
  if (!existing) throw new NotFoundError('Follow relationship');

  await repo.deleteFollow(actorId, targetId);
  return { message: 'Unfollowed successfully' };
}

export async function getFollowers(
  userId: string,
  viewerId: string | undefined,
  page: number,
  limit: number,
): Promise<{ followers: BasicUserInfo[]; meta: PaginationMeta }> {
  assertValidUserId(userId);
  const profile = await ensureCanViewProfile(viewerId, userId);

  const isOwner = viewerId === userId;
  const isFollower =
    viewerId && !isOwner ? await repo.isAcceptedFollower(viewerId, userId) : isOwner;

  const visibility = profile.privacySettings?.followersListVisibility ?? 'PUBLIC';
  if (!canViewList(visibility, isOwner, !!isFollower)) {
    throw new ForbiddenError('Followers list is not visible');
  }

  const skip = (page - 1) * limit;
  const { rows, total } = await repo.listFollowers(userId, skip, limit);
  const followers = await mapBasicUsers(
    viewerId,
    rows.map((r) => r.follower),
    true,
  );

  return { followers, meta: buildPaginationMeta(total, page, limit) };
}

export async function getFollowing(
  userId: string,
  viewerId: string | undefined,
  page: number,
  limit: number,
): Promise<{ following: BasicUserInfo[]; meta: PaginationMeta }> {
  assertValidUserId(userId);
  const profile = await ensureCanViewProfile(viewerId, userId);

  const isOwner = viewerId === userId;
  const isFollower =
    viewerId && !isOwner ? await repo.isAcceptedFollower(viewerId, userId) : isOwner;

  const visibility = profile.privacySettings?.followingListVisibility ?? 'PUBLIC';
  if (!canViewList(visibility, isOwner, !!isFollower)) {
    throw new ForbiddenError('Following list is not visible');
  }

  const skip = (page - 1) * limit;
  const { rows, total } = await repo.listFollowing(userId, skip, limit);
  const following = await mapBasicUsers(viewerId, rows.map((r) => r.following));

  return { following, meta: buildPaginationMeta(total, page, limit) };
}

export async function removeFollower(ownerId: string, followerId: string) {
  assertValidUserId(followerId);
  const existing = await repo.findFollow(followerId, ownerId);
  if (!existing || existing.status !== 'ACCEPTED') {
    throw new NotFoundError('Follower');
  }

  await repo.deleteFollow(followerId, ownerId);
  return { message: 'Follower removed' };
}

export async function acceptFollowRequest(ownerId: string, requesterId: string) {
  assertValidUserId(requesterId);
  const request = await repo.findFollow(requesterId, ownerId);
  if (!request || request.status !== 'PENDING') {
    throw new NotFoundError('Follow request');
  }

  await repo.acceptFollowRequest(ownerId, requesterId);

  await repo.createNotification({
    recipientId: requesterId,
    actorId: ownerId,
    type: 'FOLLOW_ACCEPTED',
    message: 'accepted your follow request',
  });

  return { message: 'Follow request accepted' };
}

export async function rejectFollowRequest(ownerId: string, requesterId: string) {
  assertValidUserId(requesterId);
  const request = await repo.findFollow(requesterId, ownerId);
  if (!request || request.status !== 'PENDING') {
    throw new NotFoundError('Follow request');
  }

  await repo.rejectFollowRequest(ownerId, requesterId);
  return { message: 'Follow request rejected' };
}

export async function getFollowRequests(ownerId: string): Promise<FollowRequestView[]> {
  const rows = await repo.listPendingFollowRequests(ownerId);
  const requesterIds = rows.map((r) => r.follower.id);

  const [followingIds, mutualMap] = await Promise.all([
    repo.findFollowingIds(ownerId, requesterIds),
    repo.countMutualFollows(ownerId, requesterIds),
  ]);

  return rows.map((row) => ({
    requester: toFriendCardUser(row.follower, followingIds.includes(row.follower.id)),
    mutualFriends: mutualMap.get(row.follower.id) ?? 0,
    requestedAt: row.createdAt.toISOString(),
  }));
}

export async function blockUser(actorId: string, targetId: string) {
  assertValidUserId(targetId);
  if (actorId === targetId) throw new BadRequestError('You cannot block yourself');

  await ensureProfileExists(targetId);

  const existing = await repo.findBlock(actorId, targetId);
  if (existing) throw new ConflictError('User is already blocked');

  await repo.removeAllFollowRelationships(actorId, targetId);
  await repo.createBlock(actorId, targetId);

  return { message: 'User blocked' };
}

export async function unblockUser(actorId: string, targetId: string) {
  assertValidUserId(targetId);
  const existing = await repo.findBlock(actorId, targetId);
  if (!existing) throw new NotFoundError('Block');

  await repo.deleteBlock(actorId, targetId);
  return { message: 'User unblocked' };
}

export async function getBlockedUsers(
  userId: string,
  page: number,
  limit: number,
): Promise<{ blocked: BasicUserInfo[]; meta: PaginationMeta }> {
  const skip = (page - 1) * limit;
  const { rows, total } = await repo.listBlockedUsers(userId, skip, limit);
  const blocked = await mapBasicUsers(
    userId,
    rows.map((r) => r.blocked),
  );

  return { blocked, meta: buildPaginationMeta(total, page, limit) };
}

export async function searchUsers(
  query: string,
  viewerId: string | undefined,
  page: number,
  limit: number,
): Promise<{ users: BasicUserInfo[]; meta: PaginationMeta }> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    throw new BadRequestError('Search query must be at least 2 characters');
  }

  const excludeIds = viewerId ? await repo.findBlockedUserIds(viewerId) : [];
  if (viewerId) excludeIds.push(viewerId);

  const skip = (page - 1) * limit;
  const { rows, total } = await repo.searchProfiles(trimmed, excludeIds, skip, limit);
  const users = await mapBasicUsers(viewerId, rows);

  return { users, meta: buildPaginationMeta(total, page, limit) };
}

export async function getSuggestions(userId: string): Promise<UserSuggestion[]> {
  const profile = await ensureProfileExists(userId);
  const blockedIds = await repo.findBlockedUserIds(userId);

  const following = await repo.findSecondDegreeConnections(userId);
  const mutualMap = new Map<string, number>();
  for (const edge of following) {
    if (blockedIds.includes(edge.followerId)) continue;
    mutualMap.set(edge.followerId, (mutualMap.get(edge.followerId) ?? 0) + 1);
  }

  const suggestions: UserSuggestion[] = [];
  const seen = new Set<string>([userId, ...blockedIds]);

  const sortedMutuals = [...mutualMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  if (sortedMutuals.length > 0) {
    const profiles = await repo.findProfilesByIds(sortedMutuals.map(([id]) => id));
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    for (const [id, count] of sortedMutuals) {
      const user = profileMap.get(id);
      if (!user) continue;
      seen.add(id);
      suggestions.push({
        user: toFriendCardUser(user, false),
        mutualCount: count,
        reason: 'mutual_followers',
      });
    }
  }

  if (suggestions.length < 20) {
    const contacts = await repo.findContactSuggestions(
      userId,
      [...blockedIds, ...seen],
      20 - suggestions.length,
    );
    for (const contact of contacts) {
      if (seen.has(contact.contactUserId)) continue;
      seen.add(contact.contactUserId);
      suggestions.push({
        user: toFriendCardUser(contact.contactUser, false),
        mutualCount: 0,
        reason: 'contacts',
      });
    }
  }

  if (suggestions.length < 20) {
    const locationMatches = await repo.findLocationSuggestions(
      userId,
      profile.location,
      [...blockedIds, ...seen],
      20 - suggestions.length,
    );
    for (const match of locationMatches) {
      if (seen.has(match.id)) continue;
      seen.add(match.id);
      suggestions.push({
        user: toFriendCardUser(match, false),
        mutualCount: 0,
        reason: 'location',
      });
    }
  }

  const ids = suggestions.map((s) => s.user.id);
  const followingIds = await repo.findFollowingIds(userId, ids);
  for (const suggestion of suggestions) {
    suggestion.user.isFollowing = followingIds.includes(suggestion.user.id);
  }

  return suggestions.slice(0, 20);
}

export async function updatePrivacySettings(
  userId: string,
  input: UpdatePrivacyInput,
): Promise<PrivacySettingsView> {
  await ensureProfileExists(userId);
  const settings = await repo.updatePrivacySettings(userId, input);

  return {
    isPrivate: settings.isPrivate,
    postsVisibility: settings.postsVisibility,
    messagesFrom: settings.messagesFrom,
    followersListVisibility: settings.followersListVisibility,
    followingListVisibility: settings.followingListVisibility,
  };
}

export async function getProfileIntro(
  userId: string,
  viewerId?: string,
): Promise<ProfileIntro> {
  assertValidUserId(userId);
  const profile = await ensureCanViewProfile(viewerId, userId);

  return {
    work: profile.work,
    education: profile.education,
    currentCity: profile.currentCity,
    hometown: profile.hometown,
    relationshipStatus: profile.relationshipStatus,
    joinedDate: profile.createdAt.toISOString(),
  };
}

export async function updateProfileIntro(
  userId: string,
  input: UpdateIntroInput,
): Promise<ProfileIntro> {
  await ensureProfileExists(userId);
  await repo.updateIntro(userId, input);
  return getProfileIntro(userId, userId);
}

export async function pinPost(userId: string, postId: string) {
  assertValidUserId(postId);
  const post = await repo.findPostById(postId);
  if (!post || post.authorId !== userId) {
    throw new ForbiddenError('You can only pin your own posts');
  }

  await repo.pinPost(userId, postId);
  return { message: 'Post pinned to profile', postId };
}

export async function unpinPost(userId: string) {
  await repo.unpinPost(userId);
  return { message: 'Post unpinned from profile' };
}

export async function recordHeartbeat(
  userId: string,
): Promise<{ lastSeen: string; isOnline: true }> {
  const { lastActiveAt, updated } = await repo.touchLastActive(userId);
  if (!updated) throw new NotFoundError('Profile');
  return { lastSeen: lastActiveAt.toISOString(), isOnline: true };
}
