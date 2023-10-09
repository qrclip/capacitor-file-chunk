import { Directory } from '@capacitor/filesystem';
import { BehaviorSubject, Observable } from 'rxjs';
import { FileChunkManager } from 'src/file-chunk-manager/file-chunk.manager';

export class DownloadFetchRange {
  mUseEncryption = false;
  mFileChunkManager: FileChunkManager = new FileChunkManager();
  mLocalPath = '';
  mFileSize = -1;
  mDownloading = false;
  mLastProgress = 0;
  private progressSubject = new BehaviorSubject<number>(0);
  private errorSubject = new BehaviorSubject<string | null>(null);

  get progress$(): Observable<number> {
    return this.progressSubject.asObservable();
  }

  get error$(): Observable<string | null> {
    return this.errorSubject.asObservable();
  }

  ////////////////////////////////////////////////////////////
  // DOWNLOAD FILE
  public downloadFile(tUrl: string, tPath: string, tDirectory: Directory): void {
    // IF ALREADY DOWNLOADING RETURN
    if (this.mDownloading) {
      return;
    }

    // SET DOWNLOAD STATUS AND RESET PROGRESS
    this.progressSubject.next(0);
    this.mDownloading = true;
    this.mLastProgress = -1;

    // FIRST GET THE FILE SIZE
    this.getFileSize(tUrl).then(tFileSize => {
      if (tFileSize > 0) {
        // IF OK, CONTINUE
        this.mFileSize = tFileSize;
        this.startDownload(tUrl, tPath, tDirectory);
      } else {
        this.errorDownloading('Unable to get file size!');
      }
    });
  }

  //////////////////////////////////////////////////////////////////////
  // GET FILE SIZE
  private async getFileSize(tUrl: string): Promise<number> {
    try {
      const tResponse = await fetch(tUrl, { method: 'HEAD' });
      if (!tResponse.ok) {
        return -1;
      }
      const tContentLength = tResponse.headers.get('Content-Length');

      if (tContentLength === null) {
        return -1;
      }

      const tFileSize = parseInt(tContentLength, 10);
      return tFileSize;
    } catch (error) {
      return -1;
    }
  }

  ////////////////////////////////////////////////////////////
  // START DOWNLOAD
  private async startDownload(tUrl: string, tPath: string, tDirectory: Directory): Promise<void> {
    // START THE SERVER
    const tFileChunkServerInfo = await this.mFileChunkManager.startServer({ encryption: this.mUseEncryption });
    if (tFileChunkServerInfo.ready) {
      // CREATE AN EMPTY FILE AND STORE THE PATH
      this.mLocalPath = await this.mFileChunkManager.createEmptyFile(tPath, tDirectory);
      if (this.mLocalPath === '') {
        this.errorSubject.next('Error creating file');
      }
      // IF FILE WAS CREATED START DOWNLOADING
      this.downloadAndSaveInChunks(tUrl, tFileChunkServerInfo.chunkSize, this.mFileSize);
    } else {
      this.errorSubject.next('Failed to start FileChunk');
    }
  }

  ////////////////////////////////////////////////////////////
  // DOWNLOAD AND SAVE IN CHUNKS
  private async downloadAndSaveInChunks(tUrl: string, tChunkSize: number, tFileSize: number) {
    // THIS USES THE RANGE HEADERS TO GET THE FILE
    let tCurrentPos = 0;
    let tCurrentChunk = 0;

    while (true) {
      // CALCULATE CURRENT RANGE
      tCurrentPos = tChunkSize * tCurrentChunk;
      tCurrentChunk++;
      let tEndPosition = tCurrentChunk * tChunkSize;
      if (tEndPosition > tFileSize) {
        tEndPosition = tFileSize;
      }
      const tHeaders = new Headers();
      tHeaders.append('Range', `bytes=${tCurrentPos}-${tEndPosition - 1}`);

      // FETCH THE DATA
      const tResponse = await fetch(tUrl, { headers: tHeaders });
      if (!tResponse || !tResponse.body) {
        this.errorDownloading('Unable to get file!');
        break;
      }

      // READ THE DATA AND APPEND UNTIL CHUCK IS FINISHED
      const tReader = tResponse.body.getReader();
      let currentChunk = new Uint8Array();
      while (true) {
        const { done, value } = await tReader.read();
        if (done) {
          break;
        }

        const tempChunk = new Uint8Array(currentChunk.length + value.length);
        tempChunk.set(currentChunk);
        tempChunk.set(value, currentChunk.length);
        currentChunk = tempChunk;

        if (currentChunk.length >= tChunkSize) {
          break;
        }
      }
      tReader.releaseLock();

      // NO APPEND TO FILE
      const tCurrentChunkSize = currentChunk.length;
      if (tCurrentChunkSize > 0) {
        const tOK = await this.appendDataToFile(currentChunk);
        if (!tOK) {
          this.errorDownloading('appending to file');
          break;
        }

        // SEND PROGRESS ONLY IF DIFFERENT
        const tProgress = Math.ceil(((tCurrentPos + tCurrentChunkSize) / tFileSize) * 100);
        if (this.mLastProgress !== tProgress) {
          this.mLastProgress = tProgress;
          this.progressSubject.next(tProgress);
        }
        currentChunk = new Uint8Array(); // Reset the currentChunk for the next range
      }

      if (tResponse.status !== 206) {
        // Partial Content if ok
        this.errorDownloading('Wrong status message');
        break;
      }

      // Stop downloading when reaching the total file size
      if (tCurrentPos + tCurrentChunkSize >= tFileSize) {
        this.downloadFinished();
        break;
      }
    }
  }

  //////////////////////////////////////////////////////////////////////
  // APPEND DATA TO FILE
  private async appendDataToFile(tData: Uint8Array): Promise<boolean> {
    return this.mFileChunkManager.appendChunkToFile(this.mLocalPath, tData);
  }

  //////////////////////////////////////////////////////////////////////
  // DOWNLOAD ERROR
  private errorDownloading(tError: string): void {
    this.errorSubject.next(tError);
    this.mFileChunkManager.stopServer();
    this.mDownloading = false;
  }

  //////////////////////////////////////////////////////////////////////
  // DOWNLOAD FINISHED
  private async downloadFinished(): Promise<void> {
    if (!this.mDownloading) {
      return;
    }
    this.mDownloading = false;
    const tSavedFileSize = await this.mFileChunkManager.checkFileSize(this.mLocalPath);
    this.mFileChunkManager.stopServer();
    if (tSavedFileSize === this.mFileSize) {
      this.progressSubject.next(101); // JUST IN CASE ( BECAUSE ITS CEILED ABOVE 100 CAN BE SENT SONNER)
    } else {
      this.errorDownloading('Wrong file size');
    }
  }
}
