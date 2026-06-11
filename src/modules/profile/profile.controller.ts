import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../common/errors';
import { parsePaginationParams } from '../../common/utils/paginate.util';
import { sendSuccess } from '../../common/utils/response.util';
import type { UpdateIntroDto } from './dto/update-intro.dto';
import type { UpdatePrivacyDto } from './dto/update-privacy.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { UploadCoverDto } from './dto/upload-cover.dto';
import * as profileService from './profile.service';

function requireUserId(req: Request): string {
  if (!req.user?.sub) throw new UnauthorizedError('Authentication required');
  return req.user.sub;
}

function getViewerId(req: Request): string | undefined {
  return req.user?.sub;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  const profile = await profileService.getProfile(param(req, 'userId'), getViewerId(req));
  sendSuccess(res, profile);
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const body = req.body as UpdateProfileDto;
  const profile = await profileService.updateProfile(userId, {
    ...body,
    dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
  });
  sendSuccess(res, profile, { message: 'Profile updated successfully' });
}

export async function uploadCover(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { coverUrl } = req.body as UploadCoverDto;
  const result = await profileService.uploadCoverPhoto(userId, coverUrl);
  sendSuccess(res, result, { message: 'Cover photo updated successfully' });
}

export async function getUserPosts(req: Request, res: Response): Promise<void> {
  const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
  const result = await profileService.getUserPosts(
    param(req, 'userId'),
    getViewerId(req),
    page,
    limit,
  );
  sendSuccess(res, result.posts, { meta: result.meta });
}

export async function getUserVideos(req: Request, res: Response): Promise<void> {
  const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
  const result = await profileService.getUserVideos(
    param(req, 'userId'),
    getViewerId(req),
    page,
    limit,
  );
  sendSuccess(res, result.videos, { meta: result.meta });
}

export async function followUser(req: Request, res: Response): Promise<void> {
  const actorId = requireUserId(req);
  const result = await profileService.followUser(actorId, param(req, 'userId'));
  sendSuccess(res, result, { statusCode: 201, message: result.message });
}

export async function unfollowUser(req: Request, res: Response): Promise<void> {
  const actorId = requireUserId(req);
  const result = await profileService.unfollowUser(actorId, param(req, 'userId'));
  sendSuccess(res, result, { message: result.message });
}

export async function getFollowers(req: Request, res: Response): Promise<void> {
  const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
  const result = await profileService.getFollowers(
    param(req, 'userId'),
    getViewerId(req),
    page,
    limit,
  );
  sendSuccess(res, result.followers, { meta: result.meta });
}

export async function getFollowing(req: Request, res: Response): Promise<void> {
  const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
  const result = await profileService.getFollowing(
    param(req, 'userId'),
    getViewerId(req),
    page,
    limit,
  );
  sendSuccess(res, result.following, { meta: result.meta });
}

export async function removeFollower(req: Request, res: Response): Promise<void> {
  const ownerId = requireUserId(req);
  const result = await profileService.removeFollower(ownerId, param(req, 'followerId'));
  sendSuccess(res, result, { message: result.message });
}

export async function acceptFollowRequest(req: Request, res: Response): Promise<void> {
  const ownerId = requireUserId(req);
  const result = await profileService.acceptFollowRequest(ownerId, param(req, 'requesterId'));
  sendSuccess(res, result, { message: result.message });
}

export async function rejectFollowRequest(req: Request, res: Response): Promise<void> {
  const ownerId = requireUserId(req);
  const result = await profileService.rejectFollowRequest(ownerId, param(req, 'requesterId'));
  sendSuccess(res, result, { message: result.message });
}

export async function getFollowRequests(req: Request, res: Response): Promise<void> {
  const ownerId = requireUserId(req);
  const requests = await profileService.getFollowRequests(ownerId);
  sendSuccess(res, requests);
}

export async function blockUser(req: Request, res: Response): Promise<void> {
  const actorId = requireUserId(req);
  const result = await profileService.blockUser(actorId, param(req, 'userId'));
  sendSuccess(res, result, { statusCode: 201, message: result.message });
}

export async function unblockUser(req: Request, res: Response): Promise<void> {
  const actorId = requireUserId(req);
  const result = await profileService.unblockUser(actorId, param(req, 'userId'));
  sendSuccess(res, result, { message: result.message });
}

export async function getBlockedUsers(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
  const result = await profileService.getBlockedUsers(userId, page, limit);
  sendSuccess(res, result.blocked, { meta: result.meta });
}

export async function searchUsers(req: Request, res: Response): Promise<void> {
  const q = String(req.query.q ?? '');
  const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
  const result = await profileService.searchUsers(q, getViewerId(req), page, limit);
  sendSuccess(res, result.users, { meta: result.meta });
}

export async function getSuggestions(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const suggestions = await profileService.getSuggestions(userId);
  sendSuccess(res, suggestions);
}

export async function updatePrivacy(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const settings = await profileService.updatePrivacySettings(
    userId,
    req.body as UpdatePrivacyDto,
  );
  sendSuccess(res, settings, { message: 'Privacy settings updated successfully' });
}

export async function getProfileIntro(req: Request, res: Response): Promise<void> {
  const intro = await profileService.getProfileIntro(param(req, 'userId'), getViewerId(req));
  sendSuccess(res, intro);
}

export async function updateProfileIntro(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const intro = await profileService.updateProfileIntro(userId, req.body as UpdateIntroDto);
  sendSuccess(res, intro, { message: 'Profile intro updated successfully' });
}

export async function pinPost(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const result = await profileService.pinPost(userId, param(req, 'postId'));
  sendSuccess(res, result, { message: result.message });
}

export async function unpinPost(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const result = await profileService.unpinPost(userId);
  sendSuccess(res, result, { message: result.message });
}
