import { route } from '@aurelia/router';
import { PlayerPage } from './pages/player-page/player-page';
import { BrowsePage } from './pages/browse-page/browse-page';
import { SettingsPage } from './pages/settings-page/settings-page';

@route({
  routes: [
    {
      path: ['', 'player'],
      component: PlayerPage,
      title: 'Player',
    },
    {
      path: 'browse',
      component: BrowsePage,
      title: 'Browse',
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
      title: 'Player',
  },
})
export class MyApp {
}
