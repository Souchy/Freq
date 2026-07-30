import Aurelia, { ConsoleSink, LoggerConfiguration, LogLevel } from 'aurelia';
import { RouterConfiguration } from '@aurelia/router';
import { MyApp } from './my-app';
import { I18nConfiguration } from '@aurelia/i18n';
import Fetch from 'i18next-fetch-backend';
import { DialogConfigurationStandard } from '@aurelia/dialog';
import { DefaultVirtualizationConfiguration } from '@aurelia/ui-virtualization';

async function startApp() {
  const au = new Aurelia();

  // Logger for development
  const logger = LoggerConfiguration.create({
    level: LogLevel.debug,
    colorOptions: 'colors',
    sinks: [ConsoleSink]
  });
  au.register(logger);

  // I18N
  // const osLocale = await locale();
  // const lng = osLocale?.split('-')[0] ?? 'en'; // Use only the language code, e.g. 'en' from 'en-US'
  au.register(
    I18nConfiguration.customize((options) => {
      options.initOptions = {
        // debug: true,
        plugins: [Fetch],
        backend: {
          loadPath: (lng: string, ns: string) => {
            return `/i18n/${lng}/${ns}.json`;
          },
        },
        defaultNS: 'common',
        ns: [
          ''
        ],
        lng: 'en', //lng,
        fallbackLng: 'en',
      };
    })
  );

  // Router
  au.register(RouterConfiguration.customize({
    useNavigationModel: true,
    useUrlFragmentHash: false,
    historyStrategy: 'push',     // Browser history
    basePath: '/',
  }));

  // Dialogs
  au.register(DialogConfigurationStandard.customize((settings) => {
    settings.options.overlayStyle = 'background: rgba(0, 0, 0, 0.5)';
    // settings.options.modal = true;
  }).withChild("side", settings => {
    settings.options.modal = false; // drawer, not modal
    // settings.options.overlayStyle = 'background: transparent';
    settings.options.show = dom => dom.root.classList.add('drawer-open');
    settings.options.hide = dom => dom.root.classList.remove('drawer-open');
    settings.options.overlayStyle = 'background: rgb(0, 0, 0)';
    return settings;
  }));

  // Virtualization
  au.register(DefaultVirtualizationConfiguration);

  await au.app(MyApp).start();
}
void startApp();
