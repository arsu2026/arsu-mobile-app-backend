import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { MessagePermission, VisibilityLevel } from '@prisma/client';

export class UpdatePrivacyDto {
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  @IsEnum(VisibilityLevel)
  postsVisibility?: VisibilityLevel;

  @IsOptional()
  @IsEnum(MessagePermission)
  messagesFrom?: MessagePermission;

  @IsOptional()
  @IsEnum(VisibilityLevel)
  followersListVisibility?: VisibilityLevel;

  @IsOptional()
  @IsEnum(VisibilityLevel)
  followingListVisibility?: VisibilityLevel;
}
