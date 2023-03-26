import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageHeaderComponent } from './page-header.component';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [PageHeaderComponent],
  imports: [CommonModule, IonicModule, RouterModule],
  exports: [PageHeaderComponent],
})
export class PageHeaderModule {}
