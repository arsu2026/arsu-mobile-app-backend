import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { SearchType } from '@prisma/client';

export class SaveSearchHistoryDto {
  @IsString()
  @MinLength(2, { message: 'Search query must be at least 2 characters' })
  query!: string;

  @IsOptional()
  @IsEnum(SearchType)
  searchType?: SearchType;
}
