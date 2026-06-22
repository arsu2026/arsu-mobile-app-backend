import type { ActivityType } from '@prisma/client';

export interface ActivityPreview {
  postId: string;
  thumbnailUrl: string | null;
  snippet: string | null;
}

export interface ActivityItemView {
  id: string;
  type: ActivityType;
  entityId: string | null;
  entityType: string | null;
  preview: ActivityPreview | null;
  createdAt: string;
}
