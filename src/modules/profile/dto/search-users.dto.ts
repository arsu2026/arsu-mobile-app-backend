import { IsOptional, IsString, MinLength } from 'class-validator';

export class SearchUsersDto {
  @IsString()
  @MinLength(2, { message: 'Search query must be at least 2 characters' })
  q!: string;

  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;
}
