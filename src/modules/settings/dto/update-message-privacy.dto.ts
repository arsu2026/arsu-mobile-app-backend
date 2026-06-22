import { IsEnum } from 'class-validator';
import { MessagePermission } from '@prisma/client';

export class UpdateMessagePrivacyDto {
  @IsEnum(MessagePermission, {
    message: 'Message privacy must be EVERYONE, FOLLOWERS, or NOBODY',
  })
  messagesFrom!: MessagePermission;
}
