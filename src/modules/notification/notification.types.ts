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

export interface NotificationPreferencesView {
  preferences: {
    comments: boolean;
    tags: boolean;
    reminders: boolean;
    moreActivityAboutYou: boolean;
    updatesFromFriends: boolean;
  };
  channels: {
    push: boolean;
    email: boolean;
    sms: boolean;
  };
}

export interface UpdateNotificationPrefsInput {
  preferences?: {
    comments?: boolean;
    tags?: boolean;
    reminders?: boolean;
    moreActivityAboutYou?: boolean;
    updatesFromFriends?: boolean;
  };
  channels?: {
    push?: boolean;
    email?: boolean;
    sms?: boolean;
  };
}
