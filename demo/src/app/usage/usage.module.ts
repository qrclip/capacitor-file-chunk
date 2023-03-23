import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { UsagePageRoutingModule } from './usage-routing.module';

import { UsagePage } from './usage.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, UsagePageRoutingModule],
  declarations: [UsagePage],
})
export class UsagePageModule {}
