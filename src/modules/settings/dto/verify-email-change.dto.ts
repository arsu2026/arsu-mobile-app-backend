import { IsString, Length } from 'class-validator';

export class VerifyEmailChangeDto {
  @IsString()
  @Length(6, 6, { message: 'Verification code must be 6 digits' })
  otp!: string;
}
