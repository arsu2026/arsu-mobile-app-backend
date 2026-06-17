import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListLikesDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeLikers?: boolean;
}
