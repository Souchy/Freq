import { route } from '@aurelia/router';
import { PlayerPage } from './pages/player-page/player-page';
import { SettingsPage } from './pages/settings-page/settings-page';

@route({
  routes: [
    {
      path: ['', 'player'],
      component: PlayerPage,
      title: 'Player',
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
