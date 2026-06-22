import { IsBoolean } from 'class-validator';

export class UpdateLoginAlertsDto {
  @IsBoolean()
  enabled!: boolean;
}
