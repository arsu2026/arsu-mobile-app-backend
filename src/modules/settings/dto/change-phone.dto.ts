import { IsString, Matches, MinLength } from 'class-validator';

export class ChangePhoneDto {
  @IsString()
  @MinLength(7)
  @Matches(/^\+?[0-9\s\-()]+$/, { message: 'Please provide a valid phone number' })
  newPhone!: string;
}
