import { IsUrl, MaxLength } from 'class-validator';

export class UploadCoverDto {
  @IsUrl({}, { message: 'Cover photo URL must be a valid URL' })
  @MaxLength(2048)
  coverUrl!: string;
}
