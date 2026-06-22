import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  description!: string;
}
