import { prisma } from '../../lib/prisma';

interface CreateAssetData {
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  durationSec?: number;
  thumbnailPath?: string;
}

export function createAsset(noteId: string, data: CreateAssetData) {
  return prisma.noteAsset.create({
    data: {
      noteId,
      kind: 'VIDEO',
      filePath: data.filePath,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      durationSec: data.durationSec,
      thumbnailPath: data.thumbnailPath,
    },
  });
}

export function findAssetForNote(assetId: string, noteId: string) {
  return prisma.noteAsset.findFirst({ where: { id: assetId, noteId } });
}

export function deleteAsset(assetId: string) {
  return prisma.noteAsset.delete({ where: { id: assetId } });
}
