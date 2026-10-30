import { route } from '@aurelia/router';
import { applyTheme, getTheme, Theme } from './core/theme';
import type { QueueState } from './core/player-controller';
import { PlayerPage } from './pages/player-page/player-page';
import { QueuePage } from './pages/queue-page/queue-page';
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
      path: 'queue',
      component: QueuePage,
      title: 'Queue',
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
  public queueCount = 0;

  private readonly handleThemeChange = (event: Event) => {
    this.theme = (event as CustomEvent<Theme>).detail;
  };

  private readonly handleQueueChange = (event: Event) => {
    this.queueCount = (event as CustomEvent<QueueState>).detail.items.length;
  };

  attached() {
    document.addEventListener('theme:change', this.handleThemeChange);
    document.addEventListener('player:queue', this.handleQueueChange);
    document.dispatchEvent(new CustomEvent('player:sync'));
  }

  detaching() {
    document.removeEventListener('theme:change', this.handleThemeChange);
    document.removeEventListener('player:queue', this.handleQueueChange);
  }

  public toggleTheme() {
    applyTheme(this.theme === 'dark' ? 'light' : 'dark');
  }
}
