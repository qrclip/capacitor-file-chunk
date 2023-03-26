import { Component, Input, OnDestroy } from '@angular/core';
import { DownloadFetchRange } from './download-fetch-range';
import { Directory } from '@capacitor/filesystem';
import { Subject, takeUntil } from 'rxjs';
import { FileChunkManager } from '../../file-chunk-manager/file-chunk.manager';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-download01',
  templateUrl: './download01.page.html',
  styleUrls: ['./download01.page.scss'],
})
export class Download01Page implements OnDestroy {
  @Input() mUrl = 'https://cdn.qrclip.io/dev/pi.zip'; // THIS IS NOT A ZIP (BUT CORS WAS NOT WORKING WITH TEXT FILES)
  @Input() mFilename = this.getFilenameFromUrl(this.mUrl);
  mDownloadFetchRange: DownloadFetchRange = new DownloadFetchRange();
  mProgressValue = 0;
  mDownloading = false;
  mError = '';

  private mDestroy = new Subject<any>();

  ///////////////////////////////////////////////////////////////
  // CONSTRUCTOR
  constructor(private mToastController: ToastController) {
    this.mDownloadFetchRange.progress$.pipe(takeUntil(this.mDestroy)).subscribe(tProgress => {
      if (tProgress >= 101) {
        // ONLY FINISHED WHEN 101
        // FINISHED
        this.mProgressValue = 1;
        this.mDownloading = false;
      } else {
        this.mProgressValue = (tProgress ?? 0) / 100;
      }
    });
    this.mDownloadFetchRange.error$.pipe(takeUntil(this.mDestroy)).subscribe(tError => {
      if (tError) {
        console.error(tError);
        this.mError = tError;
        this.mDownloading = false;
      }
    });
  }

  //////////////////////////////////////////////////////////////////////
  // NG ON DESTROY
  ngOnDestroy(): void {
    this.mDestroy.next(null);
    this.mDestroy.complete();
  }

  //////////////////////////////////////////////////////////////////////
  // DOWNLOAD FILE
  public async onDownloadFile() {
    this.mDownloading = true;
    this.mError = '';
    this.mDownloadFetchRange.downloadFile(this.mUrl, this.mFilename, Directory.Cache);
  }

  //////////////////////////////////////////////////////////////////////
  // ON URL CHANGED
  public onUrlChanged() {
    this.mFilename = this.getFilenameFromUrl(this.mUrl);
  }

  //////////////////////////////////////////////////////////////////////
  // ON TEST PI FILE - JUST READS THE TEST FILE (SMALL PART)
  public async onTestPiFile(): Promise<void> {
    // CREATE THE OBJECT
    const tFileChunkManager: FileChunkManager = new FileChunkManager();

    // START THE SERVER
    const tInfo = await tFileChunkManager.startServer({ encryption: false });
    if (tInfo.ready) {
      // GET THE PATH
      const tPath = await tFileChunkManager.getPath(this.mFilename, Directory.Cache);

      // READ THE FILE CHUNK
      const tChunkData = await tFileChunkManager.readFileChunk(tPath, 272121, 10);

      // JUST COMPARE
      if (tChunkData) {
        let tSub: string = '';
        const tControlData: string = '9813304777';
        for (let tChunkDatum of tChunkData) {
          tSub = tSub + String.fromCharCode(tChunkDatum);
        }
        if (tSub === tControlData) {
          this.showToast('Data OK: ' + tSub);
        } else {
          this.showToast('Wrong data at pi.zip offset');
        }
      }
    } else {
      this.showToast('Error opening pi.zip file!');
    }
  }

  //////////////////////////////////////////////////////////////////////
  // GET FILENAME FROM URL
  private getFilenameFromUrl(tUrl: string): string {
    try {
      const urlObject = new URL(tUrl);
      const pathname = urlObject.pathname;
      const lastSlashIndex = pathname.lastIndexOf('/');
      const filename = lastSlashIndex !== -1 ? pathname.substring(lastSlashIndex + 1) : pathname;
      return filename;
    } catch (e) {
      return '';
    }
  }

  //////////////////////////////////////////////////////////////////////
  // SHOW TOAST
  private async showToast(tMessage: string): Promise<void> {
    const tToast = await this.mToastController.create({
      message: tMessage,
      duration: 2000,
      position: 'top',
    });
    tToast.present();
  }
}
