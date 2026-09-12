import path from 'path';

import { NextFunction, Request, Response } from 'express';
import multer from 'multer';

import { ApiError } from '../utils/ApiError';

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'video' && !file.mimetype.startsWith('video/')) {
      cb(new Error('The video field must be a video file'));
      return;
    }
    if (file.fieldname === 'thumbnail' && !file.mimetype.startsWith('image/')) {
      cb(new Error('The thumbnail field must be an image file'));
      return;
    }
    cb(null, true);
  },
}).fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

export function uploadVideo(req: Request, res: Response, next: NextFunction): void {
  uploader(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      next(ApiError.badRequest(`Upload error: ${err.message}`));
      return;
    }
    next(ApiError.badRequest(err instanceof Error ? err.message : 'Invalid upload'));
  });
}

const MAX_IMPORT_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_IMPORT_EXTENSIONS = ['.txt', '.pdf', '.docx'];

const importFileUploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMPORT_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase())) {
      cb(new Error('File must be a .txt, .pdf, or .docx file'));
      return;
    }
    cb(null, true);
  },
}).single('file');

export function uploadImportFile(req: Request, res: Response, next: NextFunction): void {
  importFileUploader(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      next(ApiError.badRequest(`Upload error: ${err.message}`));
      return;
    }
    next(ApiError.badRequest(err instanceof Error ? err.message : 'Invalid upload'));
  });
}
