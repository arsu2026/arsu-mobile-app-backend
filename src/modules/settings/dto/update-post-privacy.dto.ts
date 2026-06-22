import { IsEnum } from 'class-validator';
import { VisibilityLevel } from '@prisma/client';

export class UpdatePostPrivacyDto {
  @IsEnum(VisibilityLevel, {
    message: 'Default post visibility must be PUBLIC, FOLLOWERS, or ONLY_ME',
  })
  postsVisibility!: VisibilityLevel;
}
