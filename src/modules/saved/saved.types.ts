import type { SavedItemType } from '@prisma/client';

export interface SavedItemView {
  id: string;
  type: SavedItemType;
  title: string | null;
  subtitle: string | null;
  thumbnailUrl: string | null;
  avatarUrl: string | null;
  source: string | null;
  collectionId: string | null;
  createdAt: string;
}

export interface SavedCollectionView {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
  createdAt: string;
}

export interface CreateSavedItemInput {
  type: SavedItemType;
  postId?: string;
  linkUrl?: string;
  linkTitle?: string;
  linkThumbnailUrl?: string;
  collectionId?: string;
}
