import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { BenchmarkPageRoutingModule } from './benchmark-routing.module';

import { BenchmarkPage } from './benchmark.page';
import { PluginInfoComponent } from './plugin-info/plugin-info.component';
import { PageHeaderModule } from '../page-header/page-header.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, BenchmarkPageRoutingModule, PageHeaderModule],
  declarations: [BenchmarkPage, PluginInfoComponent],
})
export class BenchmarkPageModule {}
