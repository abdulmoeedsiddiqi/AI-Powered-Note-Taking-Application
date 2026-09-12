import { Request, Response } from 'express';

import { getPublicPath } from '../../lib/storage';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import * as notesAssetsService from './notes-assets.service';
import { uploadAssetSchema } from './notes-assets.validation';

interface AssetLike {
  filePath: string;
  thumbnailPath: string | null;
  [key: string]: unknown;
}

export function toAssetResponse(asset: AssetLike) {
  return {
    ...asset,
    url: getPublicPath(asset.filePath),
    thumbnailUrl: asset.thumbnailPath ? getPublicPath(asset.thumbnailPath) : null,
  };
}

export const upload = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as { video?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] } | undefined;
  const videoFile = files?.video?.[0];
  if (!videoFile) {
    throw ApiError.badRequest('No video file provided');
  }

  const parsed = uploadAssetSchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid upload details', parsed.error.flatten().fieldErrors);
  }

  const thumbnailFile = files?.thumbnail?.[0];

  const asset = await notesAssetsService.addVideoAsset(req.user!.id, req.params.id, {
    video: { buffer: videoFile.buffer, mimetype: videoFile.mimetype, size: videoFile.size },
    thumbnail: thumbnailFile
      ? { buffer: thumbnailFile.buffer, mimetype: thumbnailFile.mimetype }
      : undefined,
    durationSec: parsed.data.durationSec,
  });

  res.status(201).json({ asset: toAssetResponse(asset) });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await notesAssetsService.removeVideoAsset(req.user!.id, req.params.id, req.params.assetId);
  res.status(204).send();
});
