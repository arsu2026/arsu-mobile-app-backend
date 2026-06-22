import { ExploreCategory } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';

export class ExploreQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsEnum(ExploreCategory)
  category?: ExploreCategory;

  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;
}
