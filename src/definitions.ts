export interface FileChunkConnectInfo {
  version: number;
  platform: 'web' | 'android' | 'ios';
  baseUrl: string;
  AuthToken: string;
  chunkSize: number;
}

export interface FileChunkPlugin {
  connectInfo(): Promise<FileChunkConnectInfo>;
}
