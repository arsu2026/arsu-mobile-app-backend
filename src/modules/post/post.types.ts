import type { ExploreCategory, PostPrivacy, PostType } from '@prisma/client';

export interface PostMediaView {
  id: string;
  url: string;
  position: number;
}

export interface PostView {
  id: string;
  authorId: string;
  content: string | null;
  postType: PostType;
  privacy: PostPrivacy;
  category: ExploreCategory | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  media: PostMediaView[];
  viewCount: number;
  isLongFormVideo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostInput {
  content?: string;
  privacy?: PostPrivacy;
  category?: ExploreCategory;
  images: Array<{ buffer: Buffer; mimetype: string }>;
}

export interface UpdatePostInput {
  content?: string;
  privacy?: PostPrivacy;
  category?: ExploreCategory;
}
