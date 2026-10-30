import { route } from '@aurelia/router';
import { PlayerPage } from './pages/player-page/player-page';
import { SettingsPage } from './pages/settings-page/settings-page';

@route({
  routes: [
    {
      path: ['', 'library', 'browse', 'player'],
      component: PlayerPage,
      title: 'Library',
    },
    {
      path: ['youtube', 'downloader'],
      component: import('./pages/download-page/DownloadPage'),
      title: 'YouTube',
    },
    {
      path: 'settings',
      component: SettingsPage,
      title: 'Settings',
    },
  ],
  fallback: {
    path: '',
    component: PlayerPage,
    title: 'Library',
  },
})
export class MyApp {
}
