import { route } from '@aurelia/router';
import { WelcomePage } from './pages/welcome-page/welcome-page';
import { AboutPage } from './pages/about-page/about-page';
import { PlayerPage } from './pages/player-page/player-page';
import { SettingsPage } from './pages/settings-page/settings-page';

@route({
  routes: [
    {
      path: ['', 'welcome'],
      component: WelcomePage,
      title: 'Welcome',
    },
    {
      path: 'player',
      component: PlayerPage,
      title: 'Player',
    },
    {
      path: 'settings',
      component: SettingsPage,
      title: 'Settings',
    },
    {
      path: 'about',
      component: AboutPage,
      title: 'About',
    },
  ],
})
export class MyApp {
}
