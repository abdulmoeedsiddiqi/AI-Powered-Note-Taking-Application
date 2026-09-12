import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { uploadImportFile, uploadVideo } from '../../middleware/upload';
import * as notesAssetsController from './notes-assets.controller';
import * as notesController from './notes.controller';

export const notesRouter = Router();

notesRouter.use(authenticate);

notesRouter.get('/', notesController.list);
notesRouter.get('/export', notesController.exportNotes);
notesRouter.get('/trash', notesController.listTrash);
notesRouter.post('/', notesController.create);
notesRouter.post('/import', notesController.importNotes);
notesRouter.post('/import/file', uploadImportFile, notesController.importFile);
notesRouter.get('/:id', notesController.getOne);
notesRouter.patch('/:id', notesController.update);
notesRouter.post('/:id/summarize', notesController.summarize);
notesRouter.post('/:id/restore', notesController.restore);
notesRouter.delete('/:id/purge', notesController.purge);
notesRouter.delete('/:id', notesController.remove);
notesRouter.post('/:id/assets', uploadVideo, notesAssetsController.upload);
notesRouter.delete('/:id/assets/:assetId', notesAssetsController.remove);
