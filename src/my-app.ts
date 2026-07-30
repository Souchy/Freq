import { route } from '@aurelia/router';

@route({
  routes: [
    {
      path: ['', 'welcome'],
      component: import('./welcome-page'),
      title: 'Welcome',
    },
    {
      path: 'about',
      component: import('./about-page'),
      title: 'About',
    },
    {
      path: 'downloader',
      component: import('./pages/download-page/DownloadPage'),
      title: 'Downloader',
    },
  ],
})
export class MyApp {
}
