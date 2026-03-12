import Foundation

/// Shared data models between main app and widget extension
/// Both targets must include this file

let appGroupId = "group.fr.elmouhssinine.mosquee"

struct SharedPrayerData: Codable {
    let fajr: String
    let sunrise: String
    let dhuhr: String
    let asr: String
    let maghrib: String
    let isha: String
    let iqamaFajr: String
    let iqamaDhuhr: String
    let iqamaAsr: String
    let iqamaMaghrib: String
    let iqamaIsha: String
    let jumua: String
    let hijriDay: String
    let hijriMonth: String
    let hijriYear: String
    let lastUpdate: String

    /// Parse a time string (HH:mm) into a Date for today
    func timeToDate(_ timeStr: String) -> Date? {
        guard !timeStr.isEmpty else { return nil }
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        formatter.timeZone = TimeZone(identifier: "Europe/Paris")
        guard let time = formatter.date(from: timeStr) else { return nil }

        let calendar = Calendar.current
        let now = Date()
        var components = calendar.dateComponents([.year, .month, .day], from: now)
        let timeComponents = calendar.dateComponents([.hour, .minute], from: time)
        components.hour = timeComponents.hour
        components.minute = timeComponents.minute
        components.second = 0
        return calendar.date(from: components)
    }

    /// Returns all prayers as (name, adhan time, iqama time) sorted by time
    var allPrayers: [(name: String, adhan: String, iqama: String)] {
        [
            ("Fajr", fajr, iqamaFajr),
            ("Dhuhr", dhuhr, iqamaDhuhr),
            ("Asr", asr, iqamaAsr),
            ("Maghrib", maghrib, iqamaMaghrib),
            ("Isha", isha, iqamaIsha),
        ]
    }

    /// Next prayer name and time from now
    func nextPrayer() -> (name: String, adhan: String, iqama: String, date: Date)? {
        let now = Date()
        for prayer in allPrayers {
            if let date = timeToDate(prayer.adhan), date > now {
                return (prayer.name, prayer.adhan, prayer.iqama, date)
            }
        }
        // After Isha — next is tomorrow's Fajr
        if let fajrDate = timeToDate(fajr) {
            let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: fajrDate) ?? fajrDate
            return ("Fajr", fajr, iqamaFajr, tomorrow)
        }
        return nil
    }

    /// Current prayer (the one whose time has passed most recently)
    func currentPrayer() -> String? {
        let now = Date()
        var current: String? = nil
        for prayer in allPrayers {
            if let date = timeToDate(prayer.adhan), date <= now {
                current = prayer.name
            }
        }
        return current
    }

    /// Load from shared UserDefaults
    static func load() -> SharedPrayerData? {
        guard let defaults = UserDefaults(suiteName: appGroupId),
              let data = defaults.data(forKey: "prayerTimesData") else {
            return nil
        }
        return try? JSONDecoder().decode(SharedPrayerData.self, from: data)
    }
}
