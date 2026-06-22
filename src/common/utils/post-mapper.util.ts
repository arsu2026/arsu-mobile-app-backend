import type { PostView, PostWithAuthorAndMedia, ReactionView } from '../types/post-view.types';
import { mapPrivacyLabel, splitFullName } from './display-mapper.util';

export function buildReactions(likeCount: number, isLiked: boolean): ReactionView[] {
  return [{ type: 'LIKE', count: likeCount, reacted: isLiked }];
}

export function resolveImageUrl(
  media: Array<{ url: string; position: number }>,
  mediaUrl: string | null,
): string | null {
  if (media.length > 0) {
    const sorted = [...media].sort((a, b) => a.position - b.position);
    return sorted[0].url;
  }
  return mediaUrl;
}

export function mapPostToView(
  post: PostWithAuthorAndMedia,
  isLiked = false,
): PostView {
  const author = post.author ?? {
    id: post.authorId,
    fullName: null,
    avatarUrl: null,
  };
  const { firstName, lastName } = splitFullName(author.fullName);
  const imageUrl = resolveImageUrl(post.media, post.mediaUrl);

  return {
    id: post.id,
    authorId: post.authorId,
    author: {
      id: author.id,
      fullName: author.fullName,
      firstName,
      lastName,
      avatarUrl: author.avatarUrl,
    },
    content: post.content,
    postType: post.postType,
    privacy: post.privacy,
    privacyLabel: mapPrivacyLabel(post.privacy),
    category: post.category,
    mediaUrl: post.mediaUrl,
    imageUrl,
    thumbnailUrl: post.thumbnailUrl,
    media: post.media.map((m) => ({ id: m.id, url: m.url, position: m.position })),
    viewCount: post.viewCount,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    shareCount: post.shareCount,
    isLiked,
    reactions: buildReactions(post.likeCount, isLiked),
    isLongFormVideo: post.isLongFormVideo,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

export function mapPostsToViews(
  posts: PostWithAuthorAndMedia[],
  likedPostIds: Set<string> = new Set(),
): PostView[] {
  return posts.map((post) => mapPostToView(post, likedPostIds.has(post.id)));
}
