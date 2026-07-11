import api from './client';

export type UpdateFcmTokenResponse = { success: boolean; message?: string };

/**
 * Updates resident FCM token stored in backend.
 * Backend route: PUT /api/getpass/update-fcm
 *
 * IMPORTANT — iOS notification button visibility:
 *   For Approve / Deny buttons to appear on the iOS lock-screen banner that
 *   FCM auto-renders (background or killed app), the backend MUST include
 *   the `category` and a few APNs hints in the FCM v1 payload. Example
 *   (FCM HTTP v1 send body):
 *
 *     {
 *       "message": {
 *         "token": "<fcmToken>",
 *         "notification": {
 *           "title": "Visitor Entry Request",
 *           "body":  "John is waiting at the gate"
 *         },
 *         "data": {
 *           "screen": "ApproveDeny",
 *           "visitorId": "<id>",
 *           "name": "John",
 *           "phone": "+91...",
 *           "flat": "A-101",
 *           "vehicle": "DL-1234"
 *         },
 *         "apns": {
 *           "headers": {
 *             "apns-priority": "10",
 *             "apns-push-type": "alert"
 *           },
 *           "payload": {
 *             "aps": {
 *               "category": "gatepass",          // <- required for buttons
 *               "interruption-level": "time-sensitive",
 *               "mutable-content": 1,
 *               "sound": "mygate.mp3",
 *               "alert": {
 *                 "title": "Visitor Entry Request",
 *                 "body":  "John is waiting at the gate"
 *               }
 *             }
 *           }
 *         },
 *         "android": { ... existing Android config ... }
 *       }
 *     }
 *
 *   Without `aps.category = "gatepass"`, iOS shows a plain banner with no
 *   action buttons. The category itself is registered client-side at app
 *   launch (see `setNotificationCategories` in visitorNotification.ts).
 */
export async function updateFcmToken(id: string | number, fcmToken: string): Promise<UpdateFcmTokenResponse> {
  const res = await api.put<UpdateFcmTokenResponse>('/getpass/update-fcm', { id, fcm_token: fcmToken });
  return res.data;
}

export type UpdateVoipTokenResponse = { success: boolean; message?: string };

/**
 * Updates the iOS VoIP push token for a resident. The backend uses this
 * token (separate from the FCM token) to send VoIP pushes that trigger the
 * full-screen CallKit incoming-call screen for visitor approvals.
 *
 * Backend route: PUT /api/getpass/update-voip-token
 *
 * Expected payload sent to APNs by backend:
 *   - apns-push-type: voip
 *   - apns-topic: <bundleId>.voip
 *   - apns-priority: 10
 *   - body (JSON):
 *       {
 *         "visitorId": "<id>",
 *         "name": "John Doe",
 *         "phone": "+91...",
 *         "flat": "A-101",
 *         "vehicle": "DL-1234",
 *         "title": "Visitor Entry Request",
 *         "body":  "John Doe is waiting at the gate"
 *       }
 */
export async function updateVoipToken(
  id: string | number,
  voipToken: string,
): Promise<UpdateVoipTokenResponse> {
  const res = await api.put<UpdateVoipTokenResponse>('/getpass/update-voip-token', {
    id,
    voip_token: voipToken,
    platform: 'ios',
  });
  return res.data;
}

