import type { NotificationType } from '@prisma/client';

export interface NotificationActor {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface NotificationView {
  id: string;
  type: NotificationType;
  actor: NotificationActor;
  entityId: string | null;
  message: string | null;
  isRead: boolean;
  createdAt: string;
}
