import { randomUUID } from 'crypto';

import { deleteFile, saveFile } from '../../lib/storage';
import { ApiError } from '../../utils/ApiError';
import * as notesRepository from './notes.repository';
import * as notesAssetsRepository from './notes-assets.repository';

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'video/webm': 'webm',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
  'video/ogg': 'ogv',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function extensionFromMimeType(mimeType: string): string {
  return EXTENSION_BY_MIME_TYPE[mimeType] ?? 'bin';
}

interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  size?: number;
}

interface AddVideoAssetInput {
  video: UploadedFile;
  thumbnail?: UploadedFile;
  durationSec: number;
}

export async function addVideoAsset(userId: string, noteId: string, input: AddVideoAssetInput) {
  const note = await notesRepository.findOneForUser(noteId, userId);
  if (!note) {
    throw ApiError.notFound('Note not found');
  }

  const videoFilename = `${randomUUID()}.${extensionFromMimeType(input.video.mimetype)}`;
  const filePath = await saveFile(`notes/${noteId}`, videoFilename, input.video.buffer);

  let thumbnailPath: string | undefined;
  if (input.thumbnail) {
    const thumbnailFilename = `${randomUUID()}.${extensionFromMimeType(input.thumbnail.mimetype)}`;
    thumbnailPath = await saveFile(`notes/${noteId}/thumbnails`, thumbnailFilename, input.thumbnail.buffer);
  }

  return notesAssetsRepository.createAsset(noteId, {
    filePath,
    mimeType: input.video.mimetype,
    sizeBytes: input.video.size ?? input.video.buffer.length,
    durationSec: input.durationSec,
    thumbnailPath,
  });
}

export async function removeVideoAsset(userId: string, noteId: string, assetId: string): Promise<void> {
  const note = await notesRepository.findOneForUser(noteId, userId);
  if (!note) {
    throw ApiError.notFound('Note not found');
  }

  const asset = await notesAssetsRepository.findAssetForNote(assetId, noteId);
  if (!asset) {
    throw ApiError.notFound('Asset not found');
  }

  await notesAssetsRepository.deleteAsset(assetId);
  await deleteFile(asset.filePath);
  if (asset.thumbnailPath) {
    await deleteFile(asset.thumbnailPath);
  }
}
