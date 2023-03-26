import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { UsagePageRoutingModule } from './usage-routing.module';

import { UsagePage } from './usage.page';
import { PageHeaderModule } from '../page-header/page-header.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, UsagePageRoutingModule, PageHeaderModule],
  declarations: [UsagePage],
})
export class UsagePageModule {}
