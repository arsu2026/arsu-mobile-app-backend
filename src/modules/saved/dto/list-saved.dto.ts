import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class ListSavedDto {
  @IsOptional()
  @IsIn(['post', 'video', 'link'])
  type?: string;

  @IsOptional()
  @IsUUID()
  collection?: string;

  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;
}
