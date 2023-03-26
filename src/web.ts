import { WebPlugin } from '@capacitor/core';

import type { FileChunkPlugin, FileChunkServerInfo, FileChunkConfiguration } from './definitions';


export class FileChunkWeb extends WebPlugin implements FileChunkPlugin {
  ////////////////////////////////////////////////////////////////
  // START SERVER
  async startServer(_options: FileChunkConfiguration): Promise<FileChunkServerInfo> {
    console.warn('FileChunk does not work on the browser!')
    return {
      version: 2,
      platform: 'web',
      baseUrl: 'not-needed',
      authToken: 'not-needed',
      chunkSize: 0,
      encryptionType: 'none',
      ready: false
    }
  }

  ////////////////////////////////////////////////////////////////
  // STOP SERVER
  async stopServer(): Promise<void> {
    console.warn('FileChunk does not work on the browser!')
    // DO NOTHING
  }
}
