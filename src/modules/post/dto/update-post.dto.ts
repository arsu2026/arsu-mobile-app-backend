import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ExploreCategory, PostPrivacy } from '@prisma/client';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @IsEnum(PostPrivacy)
  privacy?: PostPrivacy;

  @IsOptional()
  @IsEnum(ExploreCategory)
  category?: ExploreCategory;
}
