import { route } from '@aurelia/router';
import { applyTheme, getTheme, Theme } from './core/theme';
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
  public theme: Theme = getTheme();

  private readonly handleThemeChange = (event: Event) => {
    this.theme = (event as CustomEvent<Theme>).detail;
  };

  attached() {
    document.addEventListener('theme:change', this.handleThemeChange);
  }

  detaching() {
    document.removeEventListener('theme:change', this.handleThemeChange);
  }

  public toggleTheme() {
    applyTheme(this.theme === 'dark' ? 'light' : 'dark');
  }
}
