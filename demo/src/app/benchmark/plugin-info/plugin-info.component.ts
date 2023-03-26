import { Component, Input, OnInit } from '@angular/core';
import { FileChunkServerInfo } from '../../../../../../capacitor-file-chunk/src';

@Component({
  selector: 'app-plugin-info',
  templateUrl: './plugin-info.component.html',
  styleUrls: ['./plugin-info.component.scss'],
})
export class PluginInfoComponent implements OnInit {
  @Input() mFileChunkServerInfo: FileChunkServerInfo | null = null;

  constructor() {}

  ngOnInit() {}
}
