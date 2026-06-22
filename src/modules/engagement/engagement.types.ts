import type { PostView } from '../../common/types/post-view.types';

export interface PostLikesView {
  likeCount: number;
  isLiked: boolean;
  likers?: Array<{
    id: string;
    fullName: string | null;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  }>;
}

export interface CommentView {
  id: string;
  postId: string;
  authorId: string;
  author: PostView['author'];
  content: string;
  likeCount: number;
  isLiked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SharePostResult {
  shareCount: number;
  post: PostView;
}
