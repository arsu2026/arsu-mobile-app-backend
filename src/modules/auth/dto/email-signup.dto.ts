import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Request body for POST /auth/users/email/signup.
 *
 * Password bounds: a minimum of 8 characters for basic strength, and a maximum
 * of 72 because bcrypt (used downstream by Supabase) silently truncates beyond
 * 72 bytes — rejecting longer passwords avoids a confusing "works but ignores
 * the tail" failure mode.
 */
export class EmailSignupDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(72, { message: 'Password must not exceed 72 characters' })
  password!: string;
}
