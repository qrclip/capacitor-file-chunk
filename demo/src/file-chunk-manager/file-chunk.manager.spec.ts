import {FileChunkManager} from './file-chunk.manager';
import {Directory} from '@capacitor/filesystem';
import {
  GetUriOptions,
  GetUriResult,
  StatOptions,
  StatResult,
  WriteFileOptions,
  WriteFileResult,
} from '@capacitor/filesystem/dist/esm/definitions';
import {FileChunkConfiguration, FileChunkServerInfo} from '../../../../capacitor-file-chunk/src';
import * as Sodium from 'libsodium-wrappers';
import {base64_variants} from 'libsodium-wrappers';

// MOCKED FileChunk Plugin
export class MockedFileChunk {
  public mFileChunkServerInfo: FileChunkServerInfo = {
    version: 2,
    platform: 'web',
    baseUrl: 'not-needed',
    authToken: 'not-needed',
    chunkSize: 0,
    encryptionType: 'none',
    ready: false,
  };

  async startServer(_options: FileChunkConfiguration): Promise<FileChunkServerInfo> {
    return this.mFileChunkServerInfo;
  }

  async stopServer(): Promise<void> {}
}

// MOCKED FileSystem Plugin
export class MockedFileSystem {
  public mStatResult: StatResult | null = null;
  public mWriteFileResult: WriteFileResult | null = null;
  public mWriteFileReject = false;
  public mGetUriResult: GetUriResult | null = null;
  public mGetUriResultReject = false;

  public stat(options: StatOptions): Promise<StatResult | null> {
    return Promise.resolve(this.mStatResult);
  }

  writeFile(options: WriteFileOptions): Promise<WriteFileResult | null> {
    if (this.mWriteFileReject) {
      return Promise.reject();
    }
    return Promise.resolve(this.mWriteFileResult);
  }

  getUri(options: GetUriOptions): Promise<GetUriResult | null> {
    if (this.mGetUriResultReject) {
      return Promise.reject();
    }
    return Promise.resolve(this.mGetUriResult);
  }
}

describe('FileChunkManager', () => {
  let mFileChunkManager: FileChunkManager;

  beforeEach(() => {
    mFileChunkManager = new FileChunkManager();
  });

  ///////////////////////////////////////////////////////
  // INITIALIZATION AND CONNECTION TO PLUGIN
  it('initialization', async () => {
    expect(mFileChunkManager.mFileChunkServerInfo).toBeNull();
    expect(mFileChunkManager.mEncryptionKey).toBeNull();
    expect(mFileChunkManager.mEncryption).toBeFalse();

    await mFileChunkManager.startServer({ encryption: false });

    expect(mFileChunkManager.mFileChunkServerInfo).toBeTruthy();
  });

  ///////////////////////////////////////////////////////
  // START SERVER - NO ENCRYPTION AND NO OPTIONS
  it('start server no encryption', async () => {
    mFileChunkManager.mFileChunk = new MockedFileChunk();

    spyOn(mFileChunkManager.mFileChunk, 'startServer').and.callThrough();

    await mFileChunkManager.startServer({ encryption: false });

    expect(mFileChunkManager.mEncryption).toBeFalse();
    expect(mFileChunkManager.mEncryptionKey).toBeNull();
    expect(mFileChunkManager.mFileChunk.startServer).toHaveBeenCalledWith({
      key: '',
      encryption: false,
      port: undefined,
      portMin: undefined,
      portMax: undefined,
      retries: undefined,
      chunkSize: undefined,
    });
  });

  ///////////////////////////////////////////////////////
  // START SERVER - NO ENCRYPTION WITH OPTIONS
  it('start server no encryption and with options', async () => {
    mFileChunkManager.mFileChunk = new MockedFileChunk();

    spyOn(mFileChunkManager.mFileChunk, 'startServer').and.callThrough();

    await mFileChunkManager.startServer({
      encryption: false,
      port: 100,
      portMin: 101,
      portMax: 102,
      retries: 103,
      chunkSize: 104,
    });

    expect(mFileChunkManager.mEncryption).toBeFalse();
    expect(mFileChunkManager.mEncryptionKey).toBeNull();
    expect(mFileChunkManager.mFileChunk.startServer).toHaveBeenCalledWith({
      key: '',
      encryption: false,
      port: 100,
      portMin: 101,
      portMax: 102,
      retries: 103,
      chunkSize: 104,
    });
  });

  ///////////////////////////////////////////////////////
  // START SERVER - WITH ENCRYPTION
  it('start server with encryption', async () => {
    mFileChunkManager.mFileChunk = new MockedFileChunk();

    spyOn(mFileChunkManager.mFileChunk, 'startServer').and.callThrough();

    await mFileChunkManager.startServer({ encryption: true });

    expect(mFileChunkManager.mEncryption).toBeTrue();
    expect(mFileChunkManager.mEncryptionKey).toBeTruthy();
    expect(mFileChunkManager.mEncryptionKey?.length).toEqual(32);

    // @ts-ignore
    const tEncryptionBase64Key = Sodium.to_base64(mFileChunkManager.mEncryptionKey, base64_variants.ORIGINAL);

    expect(mFileChunkManager.mFileChunk.startServer).toHaveBeenCalledWith({
      key: tEncryptionBase64Key,
      encryption: true,
      port: undefined,
      portMin: undefined,
      portMax: undefined,
      retries: undefined,
      chunkSize: undefined,
    });
  });

  ///////////////////////////////////////////////////////
  // GET START INFO COPY (IT'S A SHALLOW COPY FOR NOW)
  it('getFileChunkConnectInfo', async () => {
    await mFileChunkManager.startServer({ encryption: false });

    const tFileChunkServerInfoCopy = mFileChunkManager.getFileChunkServerInfo();

    expect(mFileChunkManager.mFileChunkServerInfo).toEqual(tFileChunkServerInfoCopy);

    mFileChunkManager.mFileChunkServerInfo!.chunkSize = 1;

    expect(mFileChunkManager.mFileChunkServerInfo).not.toEqual(tFileChunkServerInfoCopy);
  });

  ///////////////////////////////////////////////////////
  // GET SERVER INFO NOT INITIALIZED
  it('getFileChunkServerInfo not initialized', async () => {
    const tFileChunkConnectInfoCopy = mFileChunkManager.getFileChunkServerInfo();

    expect(tFileChunkConnectInfoCopy.version).toEqual(0);
    expect(tFileChunkConnectInfoCopy.chunkSize).toEqual(0);
    expect(tFileChunkConnectInfoCopy.platform).toEqual('error');
  });

  ///////////////////////////////////////////////////////
  // GET CHUNK SIZE
  it('getChunkSize', async () => {
    await mFileChunkManager.startServer({ encryption: false });

    // @ts-ignore
    mFileChunkManager.mFileChunkServerInfo.chunkSize = 1024;

    expect(mFileChunkManager.getChunkSize()).toEqual(1024);
  });

  ///////////////////////////////////////////////////////
  // GET CHUNK SIZE NOT INITIALIZED
  it('getChunkSize not initialized', async () => {
    expect(mFileChunkManager.getChunkSize()).toEqual(0);
  });

  ///////////////////////////////////////////////////////
  // CHECK FILE SIZE EXISTING
  it('check file size - existing', async () => {
    const tMockedFileSystem = new MockedFileSystem();
    tMockedFileSystem.mStatResult = {
      type: 'file',
      size: 1024,
      ctime: 100000,
      mtime: 100000,
      uri: 'file://fake/path.txt',
    };

    // @ts-ignore
    mFileChunkManager.mFilesystem = tMockedFileSystem as unknown;

    spyOn(mFileChunkManager.mFilesystem, 'stat').and.callThrough();

    const tSize = await mFileChunkManager.checkFileSize('/fake/path.txt');

    expect(mFileChunkManager.mFilesystem.stat).toHaveBeenCalled();
    expect(tSize).toEqual(1024);
  });

  ///////////////////////////////////////////////////////
  // CHECK FILE SIZE EXISTING
  it('check file size - not found', async () => {
    const tMockedFileSystem = new MockedFileSystem();
    tMockedFileSystem.mStatResult = null;

    // @ts-ignore
    mFileChunkManager.mFilesystem = tMockedFileSystem as unknown;

    spyOn(mFileChunkManager.mFilesystem, 'stat').and.callThrough();

    const tSize = await mFileChunkManager.checkFileSize('/fake/path.txt');

    expect(mFileChunkManager.mFilesystem.stat).toHaveBeenCalled();
    expect(tSize).toEqual(-1);
  });

  ///////////////////////////////////////////////////////
  // CREATE EMPTY FILE
  it('create empty file', async () => {
    const tMockedFileSystem = new MockedFileSystem();

    tMockedFileSystem.mWriteFileResult = { uri: 'file:///fake/path.txt' };
    // @ts-ignore
    mFileChunkManager.mFilesystem = tMockedFileSystem as unknown;

    spyOn(mFileChunkManager.mFilesystem, 'writeFile').and.callThrough();

    const tPath = await mFileChunkManager.createEmptyFile('/fake/path.txt', Directory.Data);

    expect(mFileChunkManager.mFilesystem.writeFile).toHaveBeenCalled();
    expect(tPath).toEqual('/fake/path.txt');
  });

  ///////////////////////////////////////////////////////
  // CREATE EMPTY FILE FAIL
  it('create empty file - fail', async () => {
    const tMockedFileSystem = new MockedFileSystem();

    tMockedFileSystem.mWriteFileResult = null;

    // @ts-ignore
    mFileChunkManager.mFilesystem = tMockedFileSystem as unknown;

    spyOn(mFileChunkManager.mFilesystem, 'writeFile').and.callThrough();

    const tPath = await mFileChunkManager.createEmptyFile('/fake/path.txt', Directory.Data);

    expect(mFileChunkManager.mFilesystem.writeFile).toHaveBeenCalled();
    expect(tPath).toEqual('');
  });

  ///////////////////////////////////////////////////////
  // CREATE EMPTY FILE FAIL EXCEPTION
  it('create empty file - fail exception', async () => {
    const tMockedFileSystem = new MockedFileSystem();

    tMockedFileSystem.mWriteFileReject = true;

    // @ts-ignore
    mFileChunkManager.mFilesystem = tMockedFileSystem as unknown;

    spyOn(mFileChunkManager.mFilesystem, 'writeFile').and.callThrough();

    const tPath = await mFileChunkManager.createEmptyFile('/fake/path.txt', Directory.Data);

    expect(mFileChunkManager.mFilesystem.writeFile).toHaveBeenCalled();
    expect(tPath).toEqual('');
  });

  ///////////////////////////////////////////////////////
  // APPEND CHUNK TO FILE - NO ENCRYPTION
  it('appendChunkToFile - no encryption', async () => {
    await mFileChunkManager.startServer({ encryption: false });

    const tData2Append = new Uint8Array([2, 3, 5, 7, 11, 13, 17, 19, 23]);

    const tFetchResponse = new Response(null, { status: 204, statusText: 'OK' });

    spyOn(window, 'fetch').and.resolveTo(tFetchResponse);

    // @ts-ignore
    spyOn(mFileChunkManager, 'encryptBuffer').and.callThrough();

    const tAppendChunkToFileResult = await mFileChunkManager.appendChunkToFile('/fake/path.txt', tData2Append);

    // @ts-ignore
    expect(mFileChunkManager.encryptBuffer).not.toHaveBeenCalled();
    expect(tAppendChunkToFileResult).toBeTrue();
  });

  //////////////////////////////////////////////////////
  // APPEND CHUNK TO FILE - NO ENCRYPTION WRONG STATUS
  it('appendChunkToFile - wrong status', async () => {
    await mFileChunkManager.startServer({ encryption: false });

    const tData2Append = new Uint8Array([2, 3, 5, 7, 11, 13, 17, 19, 23]);

    const tFetchResponse = new Response(null, { status: 200, statusText: 'OK' });

    spyOn(window, 'fetch').and.resolveTo(tFetchResponse);

    const tAppendChunkToFileResult = await mFileChunkManager.appendChunkToFile('/fake/path.txt', tData2Append);

    expect(tAppendChunkToFileResult).toBeFalse();
  });

  //////////////////////////////////////////////////////
  // APPEND CHUNK TO FILE - THROW ERROR
  it('appendChunkToFile - fetch exception', async () => {
    await mFileChunkManager.startServer({ encryption: false });

    const tData2Append = new Uint8Array([2, 3, 5, 7, 11, 13, 17, 19, 23]);

    spyOn(window, 'fetch').and.returnValue(Promise.reject());

    const tAppendChunkToFileResult = await mFileChunkManager.appendChunkToFile('/fake/path.txt', tData2Append);

    expect(tAppendChunkToFileResult).toBeFalse();
  });

  //////////////////////////////////////////////////////
  // APPEND CHUNK TO FILE - WITH ENCRYPTION
  it('appendChunkToFile - with encryption', async () => {
    await mFileChunkManager.startServer({ encryption: true });

    const tData2Append = new Uint8Array([2, 3, 5, 7, 11, 13, 17, 19, 23]);

    // @ts-ignore
    spyOn(mFileChunkManager, 'encryptBuffer').and.callFake(() => {
      return Promise.resolve(new Uint8Array([0, 1]));
    });

    const tFetchResponse = new Response(null, { status: 200, statusText: 'OK' });
    spyOn(window, 'fetch').and.resolveTo(tFetchResponse);

    const tAppendChunkToFileResult = await mFileChunkManager.appendChunkToFile('/fake/path.txt', tData2Append);

    // @ts-ignore
    expect(mFileChunkManager.encryptBuffer).toHaveBeenCalled();

    expect(tAppendChunkToFileResult).toBeFalse();
  });

  //////////////////////////////////////////////////////
  // READ FILE CHUNK - NO ENCRYPTION
  it('readFileChunk - no encryption', async () => {
    await mFileChunkManager.startServer({ encryption: false });

    const tFetchMockedResponse = new Response(new Uint8Array([2, 3, 5, 7, 11, 13, 17, 19, 23, 29]), {
      status: 200,
      statusText: 'OK',
    });

    spyOn(window, 'fetch').and.resolveTo(tFetchMockedResponse);

    const tReadFileChunkResponse = await mFileChunkManager.readFileChunk('/fake/path.txt', 0, 10);
    expect(tReadFileChunkResponse).toEqual(new Uint8Array([2, 3, 5, 7, 11, 13, 17, 19, 23, 29]));
  });

  //////////////////////////////////////////////////////
  // READ FILE CHUNK - WITH ENCRYPTION
  it('readFileChunk - with encryption', async () => {
    await mFileChunkManager.startServer({ encryption: true });

    const tFetchMockedResponse = new Response(new Uint8Array([2, 3, 5, 7, 11, 13, 17, 19, 23, 29]), {
      status: 200,
      statusText: 'OK',
    });

    spyOn(window, 'fetch').and.resolveTo(tFetchMockedResponse);

    // @ts-ignore
    spyOn(mFileChunkManager, 'decryptBuffer').and.callFake(() => {
      return Promise.resolve(new Uint8Array([0, 1, 0, 1, 0, 1, 0, 1, 0, 1]));
    });

    const tReadFileChunkResponse = await mFileChunkManager.readFileChunk('/fake/path.txt', 0, 10);

    // @ts-ignore
    expect(mFileChunkManager.decryptBuffer).toHaveBeenCalled();

    expect(tReadFileChunkResponse).toEqual(new Uint8Array([0, 1, 0, 1, 0, 1, 0, 1, 0, 1]));
  });

  //////////////////////////////////////////////////////
  // READ FILE CHUNK - WRONG RESPONSE STATUS
  it('readFileChunk - error no 200 status code', async () => {
    await mFileChunkManager.startServer({ encryption: false });

    const tFetchMockedResponse = new Response(new Uint8Array([2, 3, 5, 7, 11, 13, 17, 19, 23, 29]), {
      status: 400,
      statusText: 'ERROR',
    });

    spyOn(window, 'fetch').and.resolveTo(tFetchMockedResponse);

    const tReadFileChunkResponse = await mFileChunkManager.readFileChunk('/fake/path.txt', 0, 10);
    expect(tReadFileChunkResponse).toBeNull();
  });

  //////////////////////////////////////////////////////
  // READ FILE CHUNK - NOT INITIALIZED
  it('readFileChunk - error not initialize', async () => {
    const tReadFileChunkResponse = await mFileChunkManager.readFileChunk('/fake/path.txt', 0, 10);
    expect(tReadFileChunkResponse).toBeNull();
  });

  //////////////////////////////////////////////////////
  // READ FILE CHUNK - FETCH ERROR
  it('readFileChunk - fetch error', async () => {
    await mFileChunkManager.startServer({ encryption: false });

    spyOn(window, 'fetch').and.returnValue(Promise.reject());

    const tReadFileChunkResponse = await mFileChunkManager.readFileChunk('/fake/path.txt', 0, 10);
    expect(tReadFileChunkResponse).toBeNull();
  });

  //////////////////////////////////////////////////////
  // ENCRYPTION AND DECRYPTION
  it('encryption and decryption', async () => {
    await mFileChunkManager.startServer({ encryption: true });

    const tOriginalData = new Uint8Array([2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);

    // ENCRYPT THE DATA
    // @ts-ignore
    const tEncryptedData = await mFileChunkManager.encryptBuffer(tOriginalData);
    expect(tEncryptedData).not.toEqual(tOriginalData);
    expect(tEncryptedData.length).toEqual(tOriginalData.length + 12 + 16); // 12 FOR THE IV LENGTH and 16 FOR THE AUTH TAG

    // DECRYPT THE DATA
    // @ts-ignore
    const tDecryptedData = await mFileChunkManager.decryptBuffer(tEncryptedData);

    // COMPARE WITH ORIGINAL
    expect(tDecryptedData).toEqual(tOriginalData);
  });

  //////////////////////////////////////////////////////
  // ENCRYPTION AND DECRYPTION - NOT INITIALIZED
  it('encryption and decryption - not initialized', async () => {
    const tDummyData = new Uint8Array([0, 1, 0, 1]);

    // ENCRYPT THE DATA
    // @ts-ignore
    const tEncryptedData = await mFileChunkManager.encryptBuffer(tDummyData);
    expect(tEncryptedData.length).toEqual(0);

    // DECRYPT THE DATA
    // @ts-ignore
    const tDecryptedData = await mFileChunkManager.decryptBuffer(tDummyData);
    expect(tDecryptedData.length).toEqual(0);
  });

  //////////////////////////////////////////////////////
  // STOP SERVER
  it('stop server', async () => {
    mFileChunkManager.mFileChunk = new MockedFileChunk();

    spyOn(mFileChunkManager.mFileChunk, 'stopServer').and.callThrough();

    await mFileChunkManager.startServer({ encryption: true });

    expect(mFileChunkManager.mFileChunkServerInfo).toBeTruthy();
    expect(mFileChunkManager.mEncryptionKey).toBeTruthy();
    expect(mFileChunkManager.mEncryption).toBeTrue();

    await mFileChunkManager.stopServer();

    expect(mFileChunkManager.mFileChunkServerInfo).toBeNull();
    expect(mFileChunkManager.mEncryptionKey).toBeNull();
    expect(mFileChunkManager.mEncryption).toBeFalse();
    expect(mFileChunkManager.mFileChunk.stopServer).toHaveBeenCalled();
  });

  ///////////////////////////////////////////////////////
  // GET PATH - OK
  it('get path - ok', async () => {
    const tMockedFileSystem = new MockedFileSystem();
    tMockedFileSystem.mGetUriResult = {
      uri: 'file:///fake/path.txt',
    };

    // @ts-ignore
    mFileChunkManager.mFilesystem = tMockedFileSystem as unknown;

    spyOn(mFileChunkManager.mFilesystem, 'getUri').and.callThrough();

    const tUri = await mFileChunkManager.getPath('/path.txt', Directory.Cache);

    expect(mFileChunkManager.mFilesystem.getUri).toHaveBeenCalled();
    expect(tUri).toEqual('/fake/path.txt');
  });

  ///////////////////////////////////////////////////////
  // GET PATH NOT FOUND
  it('get path - not found', async () => {
    const tMockedFileSystem = new MockedFileSystem();
    tMockedFileSystem.mGetUriResult = {
      uri: '',
    };

    // @ts-ignore
    mFileChunkManager.mFilesystem = tMockedFileSystem as unknown;

    spyOn(mFileChunkManager.mFilesystem, 'getUri').and.callThrough();

    const tUri = await mFileChunkManager.getPath('/path.txt', Directory.Cache);

    expect(mFileChunkManager.mFilesystem.getUri).toHaveBeenCalled();
    expect(tUri).toEqual('');
  });

  ///////////////////////////////////////////////////////
  // GET PATH EXCEPTION
  it('get path - exception', async () => {
    const tMockedFileSystem = new MockedFileSystem();
    tMockedFileSystem.mGetUriResult = {
      uri: '',
    };
    tMockedFileSystem.mGetUriResultReject = true;

    // @ts-ignore
    mFileChunkManager.mFilesystem = tMockedFileSystem as unknown;

    spyOn(mFileChunkManager.mFilesystem, 'getUri').and.callThrough();

    const tUri = await mFileChunkManager.getPath('/path.txt', Directory.Cache);

    expect(mFileChunkManager.mFilesystem.getUri).toHaveBeenCalled();
    expect(tUri).toEqual('');
  });
});
