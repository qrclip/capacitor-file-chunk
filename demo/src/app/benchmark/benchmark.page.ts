import { Component, OnInit, ViewChild } from '@angular/core';
import { IonContent, RangeCustomEvent } from '@ionic/angular';
import { FileChunkManager } from '../../file-chunk-manager/file-chunk.manager';
import { FileChunkServerInfo } from '../../../../src';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { DataConverterHelper } from './data-converter.helper';

@Component({
  selector: 'app-benchmark',
  templateUrl: './benchmark.page.html',
  styleUrls: ['./benchmark.page.scss'],
})
export class BenchmarkPage implements OnInit {
  @ViewChild('content', { static: true }) mContent: IonContent | null = null;

  mFileChunkManager: FileChunkManager = new FileChunkManager();
  mFileChunkServerInfo: FileChunkServerInfo | null = null; // JUST TO DISPLAY AT UI - NOT NEEDED TO STORE

  mFileSizes: number[] = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2000, 4000];
  mFileSizeMB = this.mFileSizes[0];
  mFileSizeIndex = 0;
  mEncryptCommunications = true;
  mUseCapacitorFilesystem = false;
  mRandomBuffer: Uint8Array | null = null;
  mLocalPath = '/test-file.bin';
  mLocalDir = Directory.Data;
  mLogEntries = '';
  mShowTestButton = true;

  mWriteTestTimeStart = 0;
  mReadTestTimeStart = 0;

  mHasErrors = false;
  mStartingServer = false;

  /////////////////////////////////////////////////////////
  // ON INIT
  ngOnInit(): void {}

  /////////////////////////////////////////////////////////
  // ON START SERVER
  async onStartServer(): Promise<void> {
    this.mStartingServer = true;
    this.mFileChunkServerInfo = await this.mFileChunkManager.startServer({ encryption: this.mEncryptCommunications });
    this.mStartingServer = false;
  }

  /////////////////////////////////////////////////////////
  // ON STOP SERVER
  async onStopServer(): Promise<void> {
    await this.mFileChunkManager.stopServer();
    this.mFileChunkServerInfo = null;
  }

  /////////////////////////////////////////////////////////
  // ON START TEST
  public async onStartTest(): Promise<void> {
    // IN CASE SERVER NOT READY
    if (!this.mFileChunkServerInfo || !this.mFileChunkServerInfo.ready) {
      this.add2Log('SERVER NOT READY', true);
      this.testFinished(true);
      return;
    }

    // RESET THE VARIABLES TO START THE TEST
    this.testStart();

    // LOG THE ENCRYPTION MODE
    if (this.mEncryptCommunications) {
      this.add2Log('ENCRYPTION ON');
    } else {
      this.add2Log('ENCRYPTION OFF');
    }
    this.add2Log('');

    // CREATE A RANDOM BUFFER TO USE FOR TESTING ( IT USES THE SERVER CHUNK SIZE )
    const tMaximumChunkSize = this.testStepCreateRandomBuffer();
    if (tMaximumChunkSize <= 0) {
      this.add2Log('ERROR - NO CHUNK SIZE', true);
      this.testFinished(true);
      return;
    }

    // TO MEASURE TIME IT TAKES TO WRITE
    this.mWriteTestTimeStart = performance.now();

    // CREATE EMPTY FILE AND GET PATH
    const tPath = await this.mFileChunkManager.createEmptyFile(this.mLocalPath, this.mLocalDir);
    if (tPath === '') {
      this.add2Log('ERROR - FAILED TO CREATE THE EMPTY FILE', true);
      this.testFinished(true);
      return;
    }

    // WRITE TEST FILE
    await this.testStepWriteTestFile(tPath, tMaximumChunkSize);
    if (this.mHasErrors) {
      this.testFinished(true);
    }

    // CALCULATE TIME IT TOOK TO WRITE
    this.calculateWriteTestSeconds();

    // CHECK FILE SIZE
    const tFile2ReadSize = await this.testStepCheckFileSize(tPath);
    if (tFile2ReadSize <= 0) {
      this.testFinished(true);
      return;
    }

    this.mReadTestTimeStart = performance.now(); // TO MEASURE TIME IT TAKES TO READ

    // READ ALL TEST FILE
    await this.testStepReadAllTestFile(tPath, tFile2ReadSize, tMaximumChunkSize);
    if (this.mHasErrors) {
      this.testFinished(true);
    }

    // TEST THE FILE CONTENTS (COMPARING WITH ARRAY)
    await this.testStepTestFileContents(tPath, tFile2ReadSize, tMaximumChunkSize);
    if (this.mHasErrors) {
      this.testFinished(true);
    }

    // CLEAN THE FILE
    await this.cleanCreatedTestFile();

    this.testFinished(false);
  }

  /////////////////////////////////////////////////////////
  // ON MOCK FILE SIZE
  public onMockFileSize(tEvent: Event) {
    const tFileSizeIndex = +(tEvent as RangeCustomEvent).detail.value;
    if (tFileSizeIndex >= 0 && tFileSizeIndex < this.mFileSizes.length) {
      this.mFileSizeMB = this.mFileSizes[tFileSizeIndex];
    }
  }

  /////////////////////////////////////////////////////////
  // APPEND CHUNK TO FILE USING CAPACITOR FILE SYSTEM ( FOR BENCHMARKING )
  public async appendChunkToFileUsingCapacitorFileSystem(tArray: Uint8Array): Promise<boolean> {
    await Filesystem.appendFile({
      path: this.mLocalPath,
      data: (await DataConverterHelper.ConvertBlobToBase64(new Blob([tArray]))) as string,
      directory: this.mLocalDir,
    });
    return true;
  }

  /////////////////////////////////////////////////////////
  // TEST START
  private testStart(): void {
    this.mHasErrors = false;
    this.mLogEntries = ''; // CLEAR LOG
    this.mShowTestButton = false;
  }

  /////////////////////////////////////////////////////////
  // TEST FINISHED
  private testFinished(tWithError: boolean): void {
    this.mShowTestButton = true;
    if (tWithError) {
      this.add2Log('');
      this.add2Log('// TEST FINISHED WITH ERROR');
      this.add2Log('//////////////////////////////////////////////////////////');
    } else {
      this.add2Log('');
      this.add2Log('// TEST FINISHED OK');
      this.add2Log('//////////////////////////////////////////////////////////');
    }
  }

  /////////////////////////////////////////////////////////
  // CREATE RANDOM BUFFER
  private createRandomBuffer(tSize: number): Uint8Array {
    return new Uint8Array(tSize).map(() => {
      return Math.floor(256 * Math.random());
    });
  }

  /////////////////////////////////////////////////////////
  // TEST STEP CREATE RANDOM BUFFER
  private testStepCreateRandomBuffer(): number {
    const tMaximumChunkSize = this.mFileChunkManager.getChunkSize();
    if (tMaximumChunkSize <= 0) {
      this.add2Log('ERROR - NO CHUNK SIZE', true);
      return 0;
    }
    this.mRandomBuffer = this.createRandomBuffer(tMaximumChunkSize);
    return tMaximumChunkSize;
  }

  /////////////////////////////////////////////////////////
  // TEST STEP WRITE TEST FILE
  private async testStepWriteTestFile(tPath: string, tMaximumChunkSize: number): Promise<void> {
    if (!this.mRandomBuffer) {
      return;
    }

    this.add2Log('//////////////////////////////////////////////////////////');
    this.add2Log('// WRITE FILE');
    if (this.mUseCapacitorFilesystem) {
      this.add2Log('WARNING: USING CAPACITOR FILE SYSTEM (NOT THE PLUGIN)');
    }
    let tChunksNeeded = Math.ceil((this.mFileSizeMB * 1000000) / tMaximumChunkSize);
    if (tChunksNeeded < 1) {
      tChunksNeeded = 1;
    }

    // MAKE THE WRITING TO FILE
    for (let i = 0; i < tChunksNeeded; i++) {
      //await new Promise(f => setTimeout(f, 2000));
      let tLength2Write = tMaximumChunkSize;
      // LAST CHUNK CALCULATE THE SIZE
      if (i === tChunksNeeded - 1) {
        tLength2Write = tMaximumChunkSize - (tChunksNeeded * tMaximumChunkSize - this.mFileSizeMB * 1000000);
      }

      this.add2LogProgress('CHUNK: ', i, tChunksNeeded - 1, tLength2Write);

      // IMPORTANT - APPEND TO THE ACTUAL FILE
      if (this.mUseCapacitorFilesystem) {
        await this.appendChunkToFileUsingCapacitorFileSystem(this.mRandomBuffer.slice(0, tLength2Write));
      } else {
        const tOK = await this.mFileChunkManager.appendChunkToFile(tPath, this.mRandomBuffer.slice(0, tLength2Write));
        if (!tOK) {
          this.add2Log('FAILED TO FETCH (PUT)', true);
        }
      }
    }
  }

  /////////////////////////////////////////////////////////
  // TEST FILE CONTENTS
  private async testStepTestFileContents(
    tPath: string,
    tFile2ReadSize: number,
    tMaximumChunkSize: number
  ): Promise<void> {
    this.add2Log('');
    this.add2Log('//////////////////////////////////////////////////////////');
    this.add2Log('// FILE CONTENT');

    let tTestOK = true;
    let tChunks2Read = Math.ceil(tFile2ReadSize / tMaximumChunkSize);
    // MAKE THE WRITING TO FILE
    let tLength2Read = tMaximumChunkSize;
    let tOffset = 0;
    for (let i = 0; i < tChunks2Read; i++) {
      if (i === tChunks2Read - 1) {
        tLength2Read = tFile2ReadSize - tOffset;
      }

      this.add2LogProgress('TEST CHUNK: ', i, tChunks2Read - 1, tLength2Read);

      const tArray = await this.mFileChunkManager.readFileChunk(tPath, tOffset, tLength2Read);

      if (tArray) {
        if (tArray.length !== tLength2Read) {
          this.add2Log('ERROR - READ SIZE NOT EQUAL: ' + tLength2Read.toString() + ' != ' + tArray.length, true);
        } else {
          if (tArray.length !== tLength2Read) {
            for (let k = 0; k < tLength2Read; k++) {
              if (tArray[k] !== this.mRandomBuffer![k]) {
                tTestOK = false;
                this.add2Log('ERROR - FILE CONTENT AT CHUNK:' + i, true);
                return;
              }
            }
          }
        }
      } else {
        this.add2Log('FAILED TO FETCH (GET)', true);
      }

      tOffset += tLength2Read;
    }

    this.add2Log('FILE CONTENT OK');
  }

  /////////////////////////////////////////////////////////
  // CLEAN THE CREATED TEST FILE
  private async cleanCreatedTestFile(): Promise<void> {
    await Filesystem.deleteFile({
      path: this.mLocalPath,
      directory: this.mLocalDir,
    });
  }


  /////////////////////////////////////////////////////////
  // TEST STEP READ TEST FILE
  private async testStepReadAllTestFile(
    tPath: string,
    tFile2ReadSize: number,
    tMaximumChunkSize: number
  ): Promise<void> {
    this.add2Log('');
    this.add2Log('//////////////////////////////////////////////////////////');
    this.add2Log('// READ FILE');
    if (this.mUseCapacitorFilesystem) {
      this.add2Log('WARNING: USING CAPACITOR FILE SYSTEM');
    }

    let tChunks2Read = Math.ceil(tFile2ReadSize / tMaximumChunkSize);
    // MAKE THE WRITING TO FILE
    let tLength2Read = tMaximumChunkSize;
    let tOffset = 0;
    let tLastChunk = false;
    for (let i = 0; i < tChunks2Read; i++) {
      if (i === tChunks2Read - 1) {
        tLength2Read = tMaximumChunkSize - (tChunks2Read * tMaximumChunkSize - tFile2ReadSize);
        tLastChunk = true;
      }
      this.add2LogProgress('CHUNK: ', i, tChunks2Read - 1, tLength2Read);

      let tReadSize = 0;
      if (!this.mUseCapacitorFilesystem) {
        // USING THE PLUGIN
        const tArray = await this.mFileChunkManager.readFileChunk(tPath, tOffset, tLength2Read);
        if (tArray) {
          tReadSize = tArray.length;
        }
      } else {
        // USING CAPACITOR FILESYSTEM
        const tArray = await this.mFileChunkManager.readFileChunkFS(tPath, tOffset, tLength2Read);
        if (tArray) {
          tReadSize = tArray.length;
        }
      }

      if (tReadSize !== tLength2Read) {
        this.add2Log('ERROR - READ SIZE NOT EQUAL: ' + tLength2Read.toString() + ' != ' + tReadSize, true);
      }

      tOffset += tLength2Read;
    }

    // CALCULATE TIME IT TOOK TO READ
    this.calculateReadTestSeconds();
  }

  /////////////////////////////////////////////////////////
  //  ADD TO LOG
  private add2Log(tLine: string, tError: boolean = false): void {
    // console.log(tLine);
    this.mLogEntries = this.mLogEntries + '\n' + tLine;
    if (tError) {
      this.mHasErrors = true;
    }
    setTimeout(() => {
      this.mContent?.scrollToBottom(0);
    }, 100);
  }

  /////////////////////////////////////////////////////////
  //  ADD TO LOG PROGRESS
  private add2LogProgress(tAppend: string, tIteration: number, tTotalIterations: number, tLength: number): void {
    this.add2Log(
      tAppend +
        tIteration.toString().padStart(2, '0') +
        '/' +
        tTotalIterations.toString().padStart(2, '0') +
        ' | ' +
        tLength
    );
  }

  /////////////////////////////////////////////////////////
  // TEST STEP CHECK FILE SIZE
  private async testStepCheckFileSize(tPath: string): Promise<number> {
    this.add2Log('');
    this.add2Log('//////////////////////////////////////////////////////////');
    this.add2Log('// CHECK FILE SIZE');
    const tWrittenFileSize = await this.mFileChunkManager.checkFileSize(tPath);
    if (tWrittenFileSize !== this.mFileSizeMB * 1000000) {
      this.add2Log('ERROR - WRONG FILE SIZE: ' + tWrittenFileSize, true);
      return 0;
    } else {
      this.add2Log('FILE SIZE OK: ' + tWrittenFileSize);
      return tWrittenFileSize;
    }
  }

  /////////////////////////////////////////////////////////
  // CALCULATE WRITE TEST SECONDS
  private calculateWriteTestSeconds(): void {
    const tTimeW1 = performance.now();
    const tTimeToWriteInSeconds = (tTimeW1 - this.mWriteTestTimeStart) / 1000;
    this.add2Log('');
    this.add2Log('# SECONDS TO WRITE: ' + tTimeToWriteInSeconds.toPrecision(2));
  }

  /////////////////////////////////////////////////////////
  // CALCULATE READ TEST SECONDS
  private calculateReadTestSeconds(): void {
    const tTimeR1 = performance.now();
    const tTimeToReadInSeconds = (tTimeR1 - this.mReadTestTimeStart) / 1000;
    this.add2Log('');
    this.add2Log('# SECONDS TO READ: ' + tTimeToReadInSeconds.toPrecision(2));
  }
}
