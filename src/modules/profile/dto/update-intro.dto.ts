import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { RelationshipStatus } from '@prisma/client';

export class UpdateIntroDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  work?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  education?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  currentCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  hometown?: string;

  @IsOptional()
  @IsEnum(RelationshipStatus)
  relationshipStatus?: RelationshipStatus;
}
