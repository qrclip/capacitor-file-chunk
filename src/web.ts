import { WebPlugin } from '@capacitor/core';

import type { FileChunkPlugin, FileChunkConnectInfo } from './definitions';


export class FileChunkWeb extends WebPlugin implements FileChunkPlugin {
  ////////////////////////////////////////////////////////////////
  // CONNECT INFO
  async connectInfo(): Promise<FileChunkConnectInfo> {
    return {
      version: 1,
      platform: 'web',
      baseUrl: 'not-needed',
      AuthToken: 'not-needed',
      chunkSize: 0
    }
  }
}
