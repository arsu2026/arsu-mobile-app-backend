import { IsOptional } from 'class-validator';

export class HashtagFeedDto {
  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;
}
