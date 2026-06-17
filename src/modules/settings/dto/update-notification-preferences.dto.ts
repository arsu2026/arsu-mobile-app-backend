import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';

class NotificationFlagsDto {
  @IsOptional() @IsBoolean() comments?: boolean;
  @IsOptional() @IsBoolean() tags?: boolean;
  @IsOptional() @IsBoolean() reminders?: boolean;
  @IsOptional() @IsBoolean() moreActivityAboutYou?: boolean;
  @IsOptional() @IsBoolean() updatesFromFriends?: boolean;
}

class NotificationChannelsDto {
  @IsOptional() @IsBoolean() push?: boolean;
  @IsOptional() @IsBoolean() email?: boolean;
  @IsOptional() @IsBoolean() sms?: boolean;
}

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationFlagsDto)
  preferences?: NotificationFlagsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  channels?: NotificationChannelsDto;
}
