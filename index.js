/**
 * @format
 */

import { AppRegistry } from 'react-native';
import notifee from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import { setBackgroundMessageHandler } from './src/services/fcm';
import {
  showGatePassNotification,
  onNotifeeBackgroundEvent,
} from './src/services/visitorNotification';

// FCM background/killed handler — show Notifee notification with Approve/Deny actions
setBackgroundMessageHandler(async (remoteMessage) => {
  await showGatePassNotification(remoteMessage);
});

// Notifee background event handler — processes action button presses (approve/deny API calls)
notifee.onBackgroundEvent(onNotifeeBackgroundEvent);

AppRegistry.registerComponent(appName, () => App);
