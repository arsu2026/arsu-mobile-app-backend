import { Router } from 'express';
import { supabaseAuthGuard } from '../../common/guards';
import * as feedController from './feed.controller';

const router = Router();

router.get('/', supabaseAuthGuard, feedController.getFeed);

export { router as feedRouter };
