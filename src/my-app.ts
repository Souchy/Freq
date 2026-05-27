import { route } from '@aurelia/router';
import { WelcomePage } from './pages/welcome-page/welcome-page';
import { AboutPage } from './pages/about-page/about-page';

@route({
  routes: [
    {
      path: ['', 'welcome'],
      component: WelcomePage,
      title: 'Welcome',
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
