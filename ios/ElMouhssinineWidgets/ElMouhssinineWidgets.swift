import WidgetKit
import SwiftUI

/// Widget Bundle — entry point for all El Mouhssinine widgets
@main
struct ElMouhssinineWidgets: WidgetBundle {
    var body: some Widget {
        NextPrayerWidget()
        PrayerTimesWidget()
    }
}
