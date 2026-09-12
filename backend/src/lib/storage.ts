import { promises as fs } from 'fs';
import path from 'path';

const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');

export async function saveFile(subdir: string, filename: string, buffer: Buffer): Promise<string> {
  const dir = path.join(UPLOADS_ROOT, subdir);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, buffer);
  return path.relative(UPLOADS_ROOT, filePath).split(path.sep).join('/');
}

export async function deleteFile(relativePath: string): Promise<void> {
  const filePath = path.join(UPLOADS_ROOT, relativePath);
  await fs.rm(filePath, { force: true });
}

export function getPublicPath(relativePath: string): string {
  return `/uploads/${relativePath}`;
}

export { UPLOADS_ROOT };
