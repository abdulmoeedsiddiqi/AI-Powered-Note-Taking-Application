import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import * as authController from './auth.controller';

export const authRouter = Router();

authRouter.post('/signup', authController.signup);
authRouter.post('/login', authController.login);
authRouter.get('/me', authenticate, authController.me);
authRouter.post('/logout', authController.logout);
authRouter.get('/ably-token', authenticate, authController.ablyToken);
