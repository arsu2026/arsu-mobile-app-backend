export type {
  PostAuthorView,
  PostMediaView,
  PostView,
  PostWithAuthorAndMedia,
  ReactionView,
} from '../../common/types/post-view.types';

export interface CreatePostInput {
  content?: string;
  privacy?: import('@prisma/client').PostPrivacy;
  category?: import('@prisma/client').ExploreCategory;
  images: Array<{ buffer: Buffer; mimetype: string }>;
}

export interface UpdatePostInput {
  content?: string;
  privacy?: import('@prisma/client').PostPrivacy;
  category?: import('@prisma/client').ExploreCategory;
}
