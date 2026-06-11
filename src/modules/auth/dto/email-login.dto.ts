import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * Request body for POST /auth/users/email/login.
 *
 * Login deliberately enforces no password policy (length/strength) beyond
 * "present" — the policy belongs at signup. Re-checking it here would leak the
 * rules to attackers and reject legitimate logins for accounts created under a
 * previous policy. An invalid password is a failed credential, not a 422.
 */
export class EmailLoginDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password!: string;
}
