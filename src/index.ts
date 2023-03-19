import { registerPlugin } from '@capacitor/core';

import type { FileChunkPlugin } from './definitions';

const FileChunk = registerPlugin<FileChunkPlugin>('FileChunk', {
  web: () => import('./web').then(m => new m.FileChunkWeb()),
});

export * from './definitions';
export { FileChunk };
