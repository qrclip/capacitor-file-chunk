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

export interface FileChunkPlugin {
  startServer(options: FileChunkConfiguration): Promise<FileChunkServerInfo>;
  stopServer(): Promise<void>;
}
