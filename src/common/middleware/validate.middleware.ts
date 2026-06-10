import { Request, Response, NextFunction } from 'express';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UnprocessableEntityError } from '../errors/app.error';

/**
 * Validation middleware factory using class-validator + class-transformer.
 *
 * Usage:
 *   import { CreateUserDto } from './dto/create-user.dto';
 *   router.post('/users', validateBody(CreateUserDto), controller);
 */
export function validateBody<T extends object>(DtoClass: new () => T) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const instance = plainToInstance(DtoClass, req.body);
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: false,
      skipMissingProperties: false,
    });

    if (errors.length > 0) {
      const formatted = errors.reduce(
        (acc, err) => {
          acc[err.property] = Object.values(err.constraints ?? {});
          return acc;
        },
        {} as Record<string, string[]>,
      );

      return next(new UnprocessableEntityError('Validation failed', formatted));
    }

    req.body = instance;
    next();
  };
}

export function validateQuery<T extends object>(DtoClass: new () => T) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const instance = plainToInstance(DtoClass, req.query);
    const errors = await validate(instance, { whitelist: true });

    if (errors.length > 0) {
      const formatted = errors.reduce(
        (acc, err) => {
          acc[err.property] = Object.values(err.constraints ?? {});
          return acc;
        },
        {} as Record<string, string[]>,
      );

      return next(new UnprocessableEntityError('Query validation failed', formatted));
    }

    req.query = instance as any;
    next();
  };
}
