import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Request body for POST /auth/users/email/reset-password.
 *
 * `token` is the recovery code Supabase emailed (a 6-digit OTP by default).
 * It is validated only as a non-empty string — Supabase verifies the actual
 * value, and pinning a length here would couple us to its OTP-length setting.
 *
 * `password` reuses signup's 8–72 bound: a minimum of 8 for basic strength and
 * a maximum of 72 because bcrypt (used downstream by Supabase) silently
 * truncates beyond 72 bytes.
 */
export class ResetPasswordDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Reset code is required' })
  token!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(72, { message: 'Password must not exceed 72 characters' })
  password!: string;
}
