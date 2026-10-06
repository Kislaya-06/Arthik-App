import { registerRootComponent } from 'expo';

import App from './App';
// Automatic Logging: defines the background + headless tasks. Must run at startup (global scope).
import './src/features/autoLog/background';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
