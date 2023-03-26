import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { Download01Page } from './download01.page';

const routes: Routes = [
  {
    path: '',
    component: Download01Page,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class Download01PageRoutingModule {}
