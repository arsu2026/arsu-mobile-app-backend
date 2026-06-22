import { IsString, Length } from 'class-validator';

export class VerifyTwoFactorDto {
  @IsString()
  @Length(6, 6, { message: 'Verification code must be 6 digits' })
  code!: string;
}
