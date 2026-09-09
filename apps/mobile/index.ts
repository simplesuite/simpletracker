// MUST be the very first import: polyfills crypto.getRandomValues() so uuid v4()
// works under Hermes/React Native. Must load before initCore, which pulls in
// core's legend/config (uuid-based generateId) and the stores.
import 'react-native-get-random-values';

// MUST be first (after the crypto polyfill): configures @simpletracker/core
// before any store loads.
import './src/initCore';

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
