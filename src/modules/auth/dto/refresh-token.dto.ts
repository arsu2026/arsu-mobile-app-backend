import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Request body for POST /auth/users/token/refresh.
 *
 * `refresh_token` is the long-lived token returned inside the `session` from
 * login/signup. It is snake_case to match the Supabase session shape the client
 * already holds. Validated only as a non-empty string — Supabase verifies the
 * actual value.
 */
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'Refresh token is required' })
  refresh_token!: string;
}
