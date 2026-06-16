import type {
  FollowStatus,
  Gender,
  MessagePermission,
  PostPrivacy,
  PostType,
  RelationshipStatus,
  VisibilityLevel,
} from '@prisma/client';

export interface BasicUserInfo {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  isFollowing: boolean;
  isFollowingBack?: boolean;
}

export interface ProfileView {
  id: string;
  username: string | null;
  fullName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  website: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;
  relationshipStatus: RelationshipStatus | null;
  location: string | null;
  followerCount: number;
  followingCount: number;
  postCount: number;
  isFollowing: boolean;
  isOwnProfile: boolean;
  isPrivate: boolean;
  followStatus: FollowStatus | null;
}

export interface ProfileIntro {
  work: string | null;
  education: string | null;
  currentCity: string | null;
  hometown: string | null;
  relationshipStatus: RelationshipStatus | null;
  joinedDate: string;
}

export interface PostView {
  id: string;
  authorId: string;
  content: string | null;
  postType: PostType;
  privacy: PostPrivacy;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  isLongFormVideo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PrivacySettingsView {
  isPrivate: boolean;
  postsVisibility: VisibilityLevel;
  messagesFrom: MessagePermission;
  followersListVisibility: VisibilityLevel;
  followingListVisibility: VisibilityLevel;
}

export interface FriendCardUser extends BasicUserInfo {
  isOnline: boolean;
  lastSeen: string | null;
}

export interface FollowRequestView {
  requester: FriendCardUser;
  mutualFriends: number;
  requestedAt: string;
}

export interface UserSuggestion {
  user: FriendCardUser;
  mutualCount: number;
  reason: 'mutual_followers' | 'contacts' | 'location';
}

export interface UpdateProfileInput {
  fullName?: string;
  username?: string;
  bio?: string;
  website?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  relationshipStatus?: RelationshipStatus;
  location?: string;
}

export interface UpdateIntroInput {
  work?: string;
  education?: string;
  currentCity?: string;
  hometown?: string;
  relationshipStatus?: RelationshipStatus;
}

export interface UpdatePrivacyInput {
  isPrivate?: boolean;
  postsVisibility?: VisibilityLevel;
  messagesFrom?: MessagePermission;
  followersListVisibility?: VisibilityLevel;
  followingListVisibility?: VisibilityLevel;
}
