// MUST be first: configures @simpletracker/core before any store loads.
import './src/initCore';

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
