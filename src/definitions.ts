export interface FileChunkServerInfo {
  version: number;
  platform: 'error' | 'web' | 'android' | 'ios';
  baseUrl: string;
  authToken: string;
  chunkSize: number;
  encryptionType: 'none' | 'ChaCha20-Poly1305'
  ready: boolean;
}

export interface FileChunkConfiguration {
  key: string;
  encryption: boolean;
  port?: number;
  portMin?: number;
  portMax?: number;
  retries?: number;
  chunkSize?: number;
}

export interface FileChunkReadChunk {
  path: string;
  offset: number;
  length: number;
}

export interface FileChunkReadChunkResponse {
  data: string;
}

export interface FileChunkPlugin {
  startServer(options: FileChunkConfiguration): Promise<FileChunkServerInfo>;
  stopServer(): Promise<void>;
  readFileChunk(options: FileChunkReadChunk): Promise<FileChunkReadChunkResponse>;
}
