import { IsString, MinLength } from 'class-validator';

export class DisableTwoFactorDto {
  @IsString()
  @MinLength(8, { message: 'Password is required' })
  password!: string;
}
