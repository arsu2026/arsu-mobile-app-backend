import { IsEmail } from 'class-validator';

/**
 * Request body for POST /auth/users/email/forgot-password.
 *
 * Only the email is needed to trigger a recovery-code email. The endpoint
 * always responds 200 regardless of whether the account exists, so no other
 * field (and no enumeration-revealing validation) belongs here.
 */
export class ForgotPasswordDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  email!: string;
}
