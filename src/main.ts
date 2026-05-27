import Aurelia from 'aurelia';
import { RouterConfiguration } from '@aurelia/router';
import { MyApp } from './my-app';
import './core/player-controller';
import { WelcomePage } from './pages/welcome-page/welcome-page';
import { AboutPage } from './pages/about-page/about-page';
import { PlayerPage } from './pages/player-page/player-page';
import { SettingsPage } from './pages/settings-page/settings-page';
import { Controls } from './components/controls/controls';
import { Library } from './components/library/library';
import { NowPlaying } from './components/now-playing/now-playing';
import { Player } from './components/player/player';
import { Queue } from './components/queue/queue';

// Aurelia
//   .register(RouterConfiguration)
//   // To use HTML5 pushState routes, replace previous line with the following
//   // customized router config.
//   // .register(RouterConfiguration.customize({ useUrlFragmentHash: false }))
//   .app(MyApp)
//   .start();


async function startApp() {
  const au = new Aurelia();
  // Logger for development
  // if (import.meta.env.VITE_NODE_ENV !== 'production') {
  //   const logger = LoggerConfiguration.create({
  //     level: LogLevel.debug,
  //     colorOptions: 'colors',
  //     sinks: [ConsoleSink]
  //   });
  //   au.register(logger);
  // }

  // Router
  // au.register(RouterConfiguration.customize({}));
  au.register(RouterConfiguration.customize({
    useNavigationModel: true,
    useUrlFragmentHash: false,
    historyStrategy: 'push',     // Browser history
    basePath: '/',
  }));

  au.register(WelcomePage, AboutPage, PlayerPage, SettingsPage);
  au.register(Controls, Library, NowPlaying, Player, Queue);

  await au.app(MyApp).start();
}


void startApp();
