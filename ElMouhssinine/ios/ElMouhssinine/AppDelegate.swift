import UIKit
internal import Expo
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import FirebaseCore
import FirebaseMessaging
import AVFoundation
import UserNotifications

@main
class AppDelegate: ExpoAppDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Initialize Firebase FIRST before any other setup
    FirebaseApp.configure()

    // Configure push notifications
    UNUserNotificationCenter.current().delegate = self
    Messaging.messaging().delegate = self

    // Register notification categories with actions (Apple Watch + iPhone)
    registerNotificationCategories()

    // Request notification authorization
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
      if granted {
        print("✅ Notification permission granted")
      } else if let error = error {
        print("❌ Notification permission error: \(error)")
      }
    }

    // Register for remote notifications
    application.registerForRemoteNotifications()

    // Configure audio session for background playback
    do {
      try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
      try AVAudioSession.sharedInstance().setActive(true)
    } catch {
      print("Failed to set audio session category: \(error)")
    }

    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "ElMouhssinine",
      in: window,
      launchOptions: launchOptions
    )

    // Initialize geofencing (restore CLLocationManager delegate for persisted regions)
    _ = MosqueGeofencingManager.shared

    // Handle relaunch by iOS when a geofence event fired while app was closed
    if launchOptions?[UIApplication.LaunchOptionsKey.location] != nil {
      MosqueGeofencingManager.shared.restartMonitoring()
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // MARK: - Deep Linking (Linking.addEventListener in RN)

  override func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    // Stocker le deep link dans UserDefaults pour lecture JS (Settings)
    // RCTLinkingManager peut rater l'event si le bridge n'écoute pas encore
    if url.absoluteString.contains("don-success") {
      UserDefaults.standard.set(url.absoluteString, forKey: "pendingDeepLink")
    }
    return RCTLinkingManager.application(app, open: url, options: options)
  }

  // MARK: - Remote Notifications

  override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
    print("📱 [APNs] Token (raw hex): \(tokenString)")
    print("📱 [APNs] Token length: \(deviceToken.count) bytes")

    // Vérifier si sandbox ou production
    #if DEBUG
    print("📱 [APNs] Environment: SANDBOX (DEBUG build)")
    #else
    print("📱 [APNs] Environment: PRODUCTION (RELEASE build)")
    #endif

    Messaging.messaging().apnsToken = deviceToken
    print("✅ [APNs] Token registered with Firebase Messaging")
  }

  override func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    print("❌ Failed to register for remote notifications: \(error)")
  }

  // MARK: - MessagingDelegate

  func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
    if let token = fcmToken {
      print("✅ FCM Token: \(token)")
    }
  }

  // MARK: - Notification Categories (Apple Watch + iPhone actions)

  private func registerNotificationCategories() {
    // -- Actions réutilisables --
    let viewTimesAction = UNNotificationAction(
      identifier: "VIEW_PRAYER_TIMES",
      title: "Horaires",
      options: .foreground
    )
    let viewDetailsAction = UNNotificationAction(
      identifier: "VIEW_DETAILS",
      title: "Détails",
      options: .foreground
    )
    let markReadAction = UNNotificationAction(
      identifier: "MARK_READ",
      title: "Lu",
      options: []
    )

    // -- Catégories --
    let prayerCategory = UNNotificationCategory(
      identifier: "PRAYER_REMINDER",
      actions: [viewTimesAction],
      intentIdentifiers: [],
      hiddenPreviewsBodyPlaceholder: "Rappel de prière",
      options: .customDismissAction
    )

    let janazaCategory = UNNotificationCategory(
      identifier: "JANAZA",
      actions: [viewDetailsAction],
      intentIdentifiers: [],
      hiddenPreviewsBodyPlaceholder: "Annonce janaza",
      options: .customDismissAction
    )

    let announcementCategory = UNNotificationCategory(
      identifier: "ANNOUNCEMENT",
      actions: [markReadAction],
      intentIdentifiers: [],
      options: []
    )

    let eventCategory = UNNotificationCategory(
      identifier: "EVENT",
      actions: [viewDetailsAction],
      intentIdentifiers: [],
      options: []
    )

    let donationCategory = UNNotificationCategory(
      identifier: "DONATION",
      actions: [viewDetailsAction],
      intentIdentifiers: [],
      options: []
    )

    let membershipCategory = UNNotificationCategory(
      identifier: "MEMBERSHIP",
      actions: [viewDetailsAction],
      intentIdentifiers: [],
      options: []
    )

    let messageCategory = UNNotificationCategory(
      identifier: "MESSAGE",
      actions: [viewDetailsAction, markReadAction],
      intentIdentifiers: [],
      options: []
    )

    let jumuaCategory = UNNotificationCategory(
      identifier: "JUMUA_REMINDER",
      actions: [viewTimesAction],
      intentIdentifiers: [],
      hiddenPreviewsBodyPlaceholder: "Rappel Jumu'a",
      options: []
    )

    UNUserNotificationCenter.current().setNotificationCategories([
      prayerCategory,
      janazaCategory,
      announcementCategory,
      eventCategory,
      donationCategory,
      membershipCategory,
      messageCategory,
      jumuaCategory,
    ])

    print("✅ Notification categories registered (8 categories)")
  }

  // MARK: - UNUserNotificationCenterDelegate

  // Handle notification when app is in foreground
  func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
    completionHandler([.banner, .sound, .badge])
  }

  // Handle notification tap or action button press
  func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
    let actionIdentifier = response.actionIdentifier
    let userInfo = response.notification.request.content.userInfo

    // Forward action to React Native via NotificationCenter
    if actionIdentifier != UNNotificationDefaultActionIdentifier &&
       actionIdentifier != UNNotificationDismissActionIdentifier {
      NotificationCenter.default.post(
        name: NSNotification.Name("NotificationActionReceived"),
        object: nil,
        userInfo: [
          "actionIdentifier": actionIdentifier,
          "userInfo": userInfo,
        ]
      )
    }

    completionHandler()
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
