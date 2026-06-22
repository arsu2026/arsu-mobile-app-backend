import { IsOptional, Matches } from 'class-validator';

export class MemoriesQueryDto {
  @IsOptional()
  @Matches(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, { message: 'date must be in MM-DD format' })
  date?: string;
}
