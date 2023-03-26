import { Component } from '@angular/core';
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
  mLogEntries = '';

  // DO EVERYTHING
  public async doEverything(): Promise<void> {
    // START THE SERVER
    const tFileChunkServerInfo = await this.mFileChunkManager.startServer({ encryption: true });
    if (!tFileChunkServerInfo.ready) {
      this.add2Console('## Failed to start the server');
      return;
    }

    this.add2Console('----FileChunkServerInfo----');
    this.add2Console(JSON.stringify(tFileChunkServerInfo));

    // CREATE A FILE
    const tPath = await this.mFileChunkManager.createEmptyFile('/test-file.bin', Directory.Data);
    this.add2Console('----tPath: ' + tPath);

    // WRITE TO THE FILE
    const tData: Uint8Array = new Uint8Array([2, 3, 5, 7, 11, 13, 17, 19, 23]); // the data you want to write
    const tOK = await this.mFileChunkManager.appendChunkToFile(tPath, tData);
    if (!tOK) {
      this.add2Console('## Failed to save to the file');
      return;
    }
    this.add2Console('----appendChunkToFile OK');
    this.add2Console('Data:' + JSON.stringify(tData));

    // CHECK THE FILE SIZE
    const tFileSize = await this.mFileChunkManager.checkFileSize(tPath);
    if (tFileSize != tData.length) {
      this.add2Console('## Wrong file size');
      return;
    }
    this.add2Console('----tFileSize: ' + tFileSize);

    // READ FROM FILE
    const tChunkData = await this.mFileChunkManager.readFileChunk(tPath, 2, 4);
    if (tChunkData && tChunkData.length !== 4) {
      this.add2Console('## Error reading from file');
      return;
    }
    this.add2Console('----readFileChunk OK ( offset 2, length 4)');
    this.add2Console('Data:' + JSON.stringify(tChunkData));

    const tData2Compare: Uint8Array = new Uint8Array([5, 7, 11, 13]);
    if (tChunkData && JSON.stringify(tChunkData) !== JSON.stringify(tData2Compare)) {
      this.add2Console('## Error wrong data!');
      return;
    }
    this.add2Console('----Data OK');

    // STOP THE SERVER
    await this.mFileChunkManager.stopServer();

    this.add2Console('----Finished----');
  }

  //////////////////////////////////////////////////////
  // ADD TO CONSOLE
  private add2Console(tText: string): void {
    this.mLogEntries += tText + '\n';
  }
}
