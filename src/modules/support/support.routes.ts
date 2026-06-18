import { Router } from 'express';
import { supabaseAuthGuard } from '../../common/guards';
import { validateBody } from '../../common/middleware/validate.middleware';
import * as supportController from './support.controller';
import { CreateReportDto } from './dto/create-report.dto';

const router = Router();

router.post('/reports', supabaseAuthGuard, validateBody(CreateReportDto), supportController.createReport);
router.get('/inbox', supabaseAuthGuard, supportController.getInbox);

export { router as supportRouter };
