import { IsOptional, IsUUID } from 'class-validator';

export class ListPostsDto {
  @IsUUID('4', { message: 'authorId must be a valid UUID' })
  authorId!: string;

  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;
}
