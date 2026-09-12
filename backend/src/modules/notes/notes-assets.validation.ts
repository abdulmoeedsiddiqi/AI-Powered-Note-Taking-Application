import { z } from 'zod';

export const MAX_VIDEO_DURATION_SECONDS = 300;

export const uploadAssetSchema = z.object({
  durationSec: z.coerce
    .number()
    .int()
    .min(1, 'Duration is required')
    .max(MAX_VIDEO_DURATION_SECONDS, 'Video must be 5 minutes or less'),
});
