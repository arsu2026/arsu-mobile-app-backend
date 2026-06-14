import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { BadRequestError } from '../errors';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILES = 10;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestError('Only JPEG, PNG, WebP, or GIF images are allowed'));
    }
  },
});

/** Parse up to 10 image files from the `images` multipart field into req.files. */
export function uploadPostImages(req: Request, res: Response, next: NextFunction): void {
  upload.array('images', MAX_FILES)(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        const message =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'Each image must be 5 MB or smaller'
            : err.code === 'LIMIT_FILE_COUNT'
              ? `You can upload at most ${MAX_FILES} images`
              : 'Image upload failed';
        return next(new BadRequestError(message));
      }
      return next(err);
    }
    next();
  });
}
