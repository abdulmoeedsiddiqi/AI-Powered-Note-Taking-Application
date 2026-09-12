import { promises as fs } from 'fs';
import path from 'path';

const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');

// Vercel's serverless filesystem is ephemeral, so in production we store uploads
// in Vercel Blob (object storage). Locally, with no token, we keep writing to
// ./uploads and serving it via the /uploads static route. The value stored in
// the database is either a Blob URL (absolute) or a disk-relative path.
const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}

export async function saveFile(subdir: string, filename: string, buffer: Buffer): Promise<string> {
  if (useBlob) {
    const { put } = await import('@vercel/blob');
    const { url } = await put(`${subdir}/${filename}`, buffer, {
      access: 'public',
      addRandomSuffix: false,
    });
    return url;
  }

  const dir = path.join(UPLOADS_ROOT, subdir);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, buffer);
  return path.relative(UPLOADS_ROOT, filePath).split(path.sep).join('/');
}

export async function deleteFile(stored: string): Promise<void> {
  if (isAbsoluteUrl(stored)) {
    const { del } = await import('@vercel/blob');
    await del(stored);
    return;
  }
  const filePath = path.join(UPLOADS_ROOT, stored);
  await fs.rm(filePath, { force: true });
}

// A Blob URL is already public; a disk-relative path is served under /uploads.
export function getPublicPath(stored: string): string {
  return isAbsoluteUrl(stored) ? stored : `/uploads/${stored}`;
}

export { UPLOADS_ROOT };
