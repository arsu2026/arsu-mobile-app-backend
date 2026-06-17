import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Gender } from '@prisma/client';

/**
 * Request body for POST /auth/users/email/signup.
 */
export class EmailSignupDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(72, { message: 'Password must not exceed 72 characters' })
  password!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;
}
