import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'menu',
    loadChildren: () => import('./menu/menu.module').then(m => m.MenuPageModule),
  },
  {
    path: 'benchmark',
    loadChildren: () => import('./benchmark/benchmark.module').then(m => m.BenchmarkPageModule),
  },
  {
    path: 'usage',
    loadChildren: () => import('./usage/usage.module').then(m => m.UsagePageModule),
  },
  {
    path: 'download01',
    loadChildren: () => import('./download01/download01.module').then(m => m.Download01PageModule),
  },
  {
    path: '',
    redirectTo: 'menu',
    pathMatch: 'full',
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
