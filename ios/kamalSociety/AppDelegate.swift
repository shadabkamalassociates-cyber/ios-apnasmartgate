import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import FirebaseCore
import FirebaseMessaging
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    FirebaseApp.configure()

    // Set up notification delegates so Firebase receives the APNs token
    UNUserNotificationCenter.current().delegate = self
    Messaging.messaging().delegate = self
    application.registerForRemoteNotifications()

    // Initialize the VoIP / CallKit handler synchronously so PushKit is
    // ready to receive incoming visitor calls before this method returns.
    // Without this, a VoIP push delivered during cold start can be dropped.
    VisitorCallManager.shared.start()

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "AapnaSmartGate",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }

  // Forward the APNs token to Firebase
  func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    Messaging.messaging().apnsToken = deviceToken
  }

  // Show notifications even when app is in foreground.
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    // Only suppress duplicates from REMOTE pushes (FCM auto-rendered banner)
    // when our JS layer is also about to display its own Notifee banner with
    // Approve / Deny actions. Local notifications (the ones Notifee schedules
    // for the test button and for the foreground gate-pass flow) have a nil
    // trigger and must NEVER be suppressed here, otherwise the user sees no
    // banner at all when the app is open.
    let isRemotePush = notification.request.trigger is UNPushNotificationTrigger
    if isRemotePush {
      let userInfo = notification.request.content.userInfo
      let screen = userInfo["screen"] as? String
      let hasVisitorId = userInfo["visitorId"] != nil
        || userInfo["visitor_id"] != nil
        || userInfo["gatepassId"] != nil
        || userInfo["gatepass_id"] != nil
      if screen == "ApproveDeny" || hasVisitorId {
        completionHandler([])
        return
      }
    }

    if #available(iOS 14.0, *) {
      completionHandler([.banner, .list, .sound, .badge])
    } else {
      completionHandler([.alert, .sound, .badge])
    }
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
