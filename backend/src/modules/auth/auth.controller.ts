import { Request, Response } from 'express';

import { env } from '../../config/env';
import { createAblyTokenRequest, isRealtimeConfigured } from '../../lib/realtime';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { JWT_EXPIRES_IN_SECONDS } from '../../utils/jwt';
import * as authService from './auth.service';
import { loginSchema, signupSchema } from './auth.validation';

function setAuthCookie(res: Response, token: string): void {
  res.cookie(env.cookieName, token, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: JWT_EXPIRES_IN_SECONDS * 1000,
    path: '/',
  });
}

function clearAuthCookie(res: Response): void {
  res.clearCookie(env.cookieName, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid signup details', parsed.error.flatten().fieldErrors);
  }

  const { user, token } = await authService.signup(parsed.data);
  setAuthCookie(res, token);
  res.status(201).json({ user });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid login details', parsed.error.flatten().fieldErrors);
  }

  const { user, token } = await authService.login(parsed.data);
  setAuthCookie(res, token);
  res.status(200).json({ user });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getCurrentUser(req.user!.id);
  res.status(200).json({ user });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.status(204).send();
});

// Issues a short-lived Ably token scoped to the authenticated user's own
// real-time channel, so the browser can subscribe without ever seeing the key.
export const ablyToken = asyncHandler(async (req: Request, res: Response) => {
  if (!isRealtimeConfigured()) {
    throw ApiError.badRequest('Real-time is not configured on this server');
  }
  const tokenRequest = await createAblyTokenRequest(req.user!.id);
  res.status(200).json(tokenRequest);
});
