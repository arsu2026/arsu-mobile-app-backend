import type { ExploreCategory, PostPrivacy, PostType } from '@prisma/client';

export interface PostMediaView {
  id: string;
  url: string;
  position: number;
}

export interface PostAuthorView {
  id: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}

export interface ReactionView {
  type: 'LIKE';
  count: number;
  reacted: boolean;
}

export interface PostView {
  id: string;
  authorId: string;
  author: PostAuthorView;
  content: string | null;
  postType: PostType;
  privacy: PostPrivacy;
  privacyLabel: string;
  category: ExploreCategory | null;
  mediaUrl: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  media: PostMediaView[];
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  isLiked: boolean;
  reactions: ReactionView[];
  isLongFormVideo: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PostWithAuthorAndMedia = {
  id: string;
  authorId: string;
  content: string | null;
  postType: PostType;
  privacy: PostPrivacy;
  category: ExploreCategory | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  isLongFormVideo: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  media: Array<{ id: string; url: string; position: number }>;
};
