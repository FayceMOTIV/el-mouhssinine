import CoreLocation
import UserNotifications

// MARK: - MosqueGeofencingManager (singleton, pure Swift, zero React Native)
// Gère le geofencing natif iOS via CLCircularRegion.
// iOS maintient la surveillance au niveau OS, même si l'app est tuée.
// Quand l'utilisateur entre dans la zone, iOS relance l'app et déclenche didEnterRegion.

@objc public class MosqueGeofencingManager: NSObject, CLLocationManagerDelegate {

  @objc public static let shared = MosqueGeofencingManager()

  private let locationManager = CLLocationManager()
  private let mosqueRegion: CLCircularRegion
  private let cooldownSeconds: TimeInterval = 30 * 60 // 30 minutes
  private let enabledKey = "mosqueGeofencingEnabled"

  /// True seulement après un appel explicite à start().
  /// Persisté dans UserDefaults pour survivre aux relaunches iOS.
  private var wantsMonitoring: Bool {
    get { UserDefaults.standard.bool(forKey: enabledKey) }
    set { UserDefaults.standard.set(newValue, forKey: enabledKey) }
  }

  private override init() {
    mosqueRegion = CLCircularRegion(
      center: CLLocationCoordinate2D(latitude: 46.2055668, longitude: 5.2477947),
      radius: 200,
      identifier: "mosquee-el-mouhssinine"
    )
    mosqueRegion.notifyOnEntry = true
    mosqueRegion.notifyOnExit = false

    super.init()

    locationManager.delegate = self
    locationManager.allowsBackgroundLocationUpdates = true
  }

  // MARK: - Cooldown check

  private var cooldownOK: Bool {
    let last = UserDefaults.standard.double(forKey: "lastMosqueeNotifTimestamp")
    return Date().timeIntervalSince1970 - last > cooldownSeconds
  }

  // MARK: - Start monitoring (private helper)

  private func beginMonitoring() {
    guard CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self) else {
      print("[MosqueGeofencing] Region monitoring not available on this device")
      return
    }
    locationManager.startMonitoring(for: mosqueRegion)
    print("[MosqueGeofencing] Started monitoring (radius: \(mosqueRegion.radius)m)")
  }

  // MARK: - Public API

  @objc public func start() {
    wantsMonitoring = true

    let status = locationManager.authorizationStatus
    if status == .authorizedAlways {
      beginMonitoring()
    } else if status == .notDetermined || status == .authorizedWhenInUse {
      // Le delegate locationManagerDidChangeAuthorization démarrera le monitoring
      // quand l'utilisateur accordera la permission "Toujours"
      print("[MosqueGeofencing] Requesting Always authorization (current: \(status.rawValue))...")
      locationManager.requestAlwaysAuthorization()
    } else {
      print("[MosqueGeofencing] Authorization denied (\(status.rawValue)), cannot monitor")
    }
  }

  @objc public func stop() {
    wantsMonitoring = false
    locationManager.stopMonitoring(for: mosqueRegion)
    print("[MosqueGeofencing] Stopped monitoring")
  }

  @objc public func restartMonitoring() {
    // Appelé quand iOS relance l'app suite à un événement de géofence.
    // À ce stade le JS bridge n'est pas encore prêt → on vérifie le flag UserDefaults.
    guard wantsMonitoring else {
      print("[MosqueGeofencing] restartMonitoring: disabled in settings, skip")
      return
    }
    beginMonitoring()
    print("[MosqueGeofencing] Restarted monitoring (location launch)")
  }

  // MARK: - CLLocationManagerDelegate

  public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    let status = manager.authorizationStatus
    print("[MosqueGeofencing] Authorization changed: \(status.rawValue)")
    // Ne démarre le monitoring QUE si start() a été appelé explicitement
    if status == .authorizedAlways && wantsMonitoring {
      beginMonitoring()
    }
  }

  public func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
    guard region.identifier == "mosquee-el-mouhssinine" else { return }
    print("[MosqueGeofencing] Entered mosque region")

    guard cooldownOK else {
      let last = UserDefaults.standard.double(forKey: "lastMosqueeNotifTimestamp")
      let remaining = Int((cooldownSeconds - (Date().timeIntervalSince1970 - last)) / 60)
      print("[MosqueGeofencing] Cooldown active, \(remaining) min remaining")
      return
    }

    UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "lastMosqueeNotifTimestamp")
    sendLocalNotification()
  }

  public func locationManager(_ manager: CLLocationManager, monitoringDidFailFor region: CLRegion?, withError error: Error) {
    print("[MosqueGeofencing] monitoringDidFail for \(region?.identifier ?? "unknown"): \(error.localizedDescription)")
  }

  public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    print("[MosqueGeofencing] didFail: \(error.localizedDescription)")
  }

  // MARK: - Local notification (sent natively, works even if JS bridge is not ready)

  private func sendLocalNotification() {
    let content = UNMutableNotificationContent()
    content.title = "🕌 Vous êtes à la mosquée"
    content.body = "N'oubliez pas de mettre votre téléphone en mode silencieux 🔕"
    content.sound = .default

    let request = UNNotificationRequest(
      identifier: "mosquee-silencieux-\(Int(Date().timeIntervalSince1970))",
      content: content,
      trigger: nil // Immediate
    )

    UNUserNotificationCenter.current().add(request) { error in
      if let error = error {
        print("[MosqueGeofencing] Notification error: \(error.localizedDescription)")
      } else {
        print("[MosqueGeofencing] Notification sent!")
      }
    }
  }
}

// MARK: - MosqueGeofencing (React Native bridge wrapper)
// Thin wrapper that delegates to MosqueGeofencingManager.shared.
// Exposed to JS via MosqueGeofencingBridge.m (RCT_EXTERN_MODULE).

@objc(MosqueGeofencing)
class MosqueGeofencing: NSObject {

  @objc func start() {
    MosqueGeofencingManager.shared.start()
  }

  @objc func stop() {
    MosqueGeofencingManager.shared.stop()
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
