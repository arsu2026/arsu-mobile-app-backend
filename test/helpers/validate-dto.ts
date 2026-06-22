import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';

/**
 * Validate a plain payload against a DTO class using the SAME options as
 * validateBody() (src/common/middleware/validate.middleware.ts), so DTO specs
 * pin the real production contract instead of each re-declaring a copy that can
 * silently drift from the middleware.
 */
export function validateDto<T extends object>(
  DtoClass: new () => T,
  payload: Record<string, unknown>,
): Promise<ValidationError[]> {
  const instance = plainToInstance(DtoClass, payload);
  return validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: false,
    skipMissingProperties: false,
  });
}
