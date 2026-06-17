import { Router } from 'express';
import { supabaseAuthGuard } from '../../common/guards';
import { uploadSingleImage } from '../../common/middleware/upload.middleware';
import * as mediaController from './media.controller';

const router = Router();

router.post('/upload', supabaseAuthGuard, uploadSingleImage, mediaController.uploadMedia);

export { router as mediaRouter };
