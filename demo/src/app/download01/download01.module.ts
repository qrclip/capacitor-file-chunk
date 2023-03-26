import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { Download01PageRoutingModule } from './download01-routing.module';

import { Download01Page } from './download01.page';
import { PageHeaderModule } from '../page-header/page-header.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, Download01PageRoutingModule, PageHeaderModule],
  declarations: [Download01Page],
})
export class Download01PageModule {}
