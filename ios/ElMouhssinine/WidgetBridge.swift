import Foundation
import WidgetKit

@objc(WidgetBridge)
class WidgetBridge: NSObject {

  private let appGroupId = "group.fr.elmouhssinine.mosquee"

  /// Called from React Native when prayer times are fetched/updated
  @objc func updatePrayerData(_ prayerData: NSDictionary) {
    guard let defaults = UserDefaults(suiteName: appGroupId) else {
      print("[WidgetBridge] App Group UserDefaults not available")
      return
    }

    if let jsonData = try? JSONSerialization.data(withJSONObject: prayerData) {
      defaults.set(jsonData, forKey: "prayerTimesData")
      defaults.set(Date().timeIntervalSince1970, forKey: "lastUpdate")
      print("[WidgetBridge] Prayer data updated in App Groups")
    }

    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }

  /// Called from React Native when announcements/events change
  @objc func updateAnnouncements(_ announcements: NSArray) {
    guard let defaults = UserDefaults(suiteName: appGroupId) else { return }

    if let jsonData = try? JSONSerialization.data(withJSONObject: announcements) {
      defaults.set(jsonData, forKey: "announcements")
    }

    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadTimelines(ofKind: "AnnouncementsWidget")
    }
  }

  /// Force reload all widget timelines
  @objc func reloadWidgets() {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
      print("[WidgetBridge] All widget timelines reloaded")
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool { return false }
}
