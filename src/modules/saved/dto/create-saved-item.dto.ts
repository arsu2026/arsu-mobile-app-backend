import { SavedItemType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl, IsUUID, MaxLength, ValidateIf } from 'class-validator';

export class CreateSavedItemDto {
  @IsEnum(SavedItemType)
  type!: SavedItemType;

  @ValidateIf((o) => o.type === 'POST' || o.type === 'VIDEO')
  @IsUUID()
  postId?: string;

  @ValidateIf((o) => o.type === 'LINK')
  @IsUrl()
  linkUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  linkTitle?: string;

  @IsOptional()
  @IsUrl()
  linkThumbnailUrl?: string;

  @IsOptional()
  @IsUUID()
  collectionId?: string;
}
