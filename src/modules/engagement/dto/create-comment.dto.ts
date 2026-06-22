import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1, { message: 'Comment cannot be empty' })
  @MaxLength(2000, { message: 'Comment must not exceed 2000 characters' })
  content!: string;
}
