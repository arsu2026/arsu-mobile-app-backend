import type { ExploreCategory, PostPrivacy, PostType, SearchType } from '@prisma/client';
import type { BasicUserInfo } from '../profile/profile.types';

export interface SearchPostView {
  id: string;
  authorId: string;
  author: Pick<BasicUserInfo, 'id' | 'username' | 'fullName' | 'avatarUrl'>;
  content: string | null;
  title: string | null;
  description: string | null;
  postType: PostType;
  privacy: PostPrivacy;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  isLongFormVideo: boolean;
  viewCount: number;
  createdAt: string;
}

export interface HashtagView {
  id: string;
  name: string;
  postCount: number;
}

export interface SearchHistoryView {
  id: string;
  query: string;
  searchType: SearchType;
  searchedAt: string;
}

export interface UnifiedSearchResult {
  query: string;
  type: SearchType;
  users: BasicUserInfo[];
  posts: SearchPostView[];
  videos: SearchPostView[];
  shorts: SearchPostView[];
  hashtags: HashtagView[];
}

export interface ExploreItemView extends SearchPostView {
  category: ExploreCategory | null;
  trendingScore: number;
}

export type ExploreCategoryFilter = ExploreCategory;
