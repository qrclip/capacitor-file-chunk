import { Component, OnInit } from '@angular/core';
import { Directory } from '@capacitor/filesystem';
import { FileChunkManager } from '../../file-chunk-manager/file-chunk.manager';

@Component({
  selector: 'app-usage',
  templateUrl: './usage.page.html',
  styleUrls: ['./usage.page.scss'],
})
export class UsagePage {
  // CREATE THE MANAGER CLASS
  mFileChunkManager: FileChunkManager = new FileChunkManager();

  public async doEverything(): Promise<void> {
    // START THE SERVER
    const tFileChunkServerInfo = await this.mFileChunkManager.startServer({ encryption: true });
    if (!tFileChunkServerInfo.ready) {
      console.error('## Failed to start the server');
      return;
    }

    console.log(tFileChunkServerInfo);

    // CREATE A FILE
    const tPath = await this.mFileChunkManager.createEmptyFile('/test-file.bin', Directory.Data);

    // WRITE TO THE FILE
    const tData: Uint8Array = new Uint8Array([2, 3, 5, 7, 11, 13, 17, 19, 23]); // the data you want to write
    const tOK = await this.mFileChunkManager.appendChunkToFile(tPath, tData);
    if (!tOK) {
      console.error('## Failed to save to the file');
      return;
    }

    // CHECK THE FILE SIZE
    const tFileSize = await this.mFileChunkManager.checkFileSize(tPath);
    if (tFileSize != tData.length) {
      console.error('## Wrong file size');
      return;
    }

    // READ FROM FILE
    const tChunkData = await this.mFileChunkManager.readFileChunk(tPath, 2, 4);
    if (tChunkData && tChunkData.length !== 4) {
      console.error('## Error reading from file');
      return;
    }

    const tData2Compare: Uint8Array = new Uint8Array([5, 7, 11, 13]);
    if (tChunkData && JSON.stringify(tChunkData) !== JSON.stringify(tData2Compare)) {
      console.error('## Error wrong data!');
      return;
    }

    // STOP THE SERVER
    await this.mFileChunkManager.stopServer();
  }
}
