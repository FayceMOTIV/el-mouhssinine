import WidgetKit
import SwiftUI

// MARK: - Timeline Entry

struct PrayerTimesEntry: TimelineEntry {
    let date: Date
    let prayers: [(name: String, adhan: String, iqama: String)]
    let currentPrayer: String?
    let hijriDate: String
    let isPlaceholder: Bool

    static var placeholder: PrayerTimesEntry {
        PrayerTimesEntry(
            date: Date(),
            prayers: [
                ("Fajr", "05:32", "06:00"),
                ("Dhuhr", "13:15", "13:30"),
                ("Asr", "16:42", "17:00"),
                ("Maghrib", "19:58", "20:03"),
                ("Isha", "21:15", "21:30"),
            ],
            currentPrayer: "Dhuhr",
            hijriDate: "15 Ramadan 1447",
            isPlaceholder: true
        )
    }
}

// MARK: - Timeline Provider

struct PrayerTimesProvider: TimelineProvider {
    func placeholder(in context: Context) -> PrayerTimesEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (PrayerTimesEntry) -> Void) {
        completion(makeEntry() ?? .placeholder)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerTimesEntry>) -> Void) {
        guard let data = SharedPrayerData.load() else {
            completion(Timeline(entries: [.placeholder], policy: .after(Date().addingTimeInterval(900))))
            return
        }

        var entries: [PrayerTimesEntry] = []
        let hijri = [data.hijriDay, data.hijriMonth, data.hijriYear]
            .filter { !$0.isEmpty }
            .joined(separator: " ")

        // Create an entry at each prayer time so "current prayer" highlight updates
        for prayer in data.allPrayers {
            if let prayerDate = data.timeToDate(prayer.adhan) {
                entries.append(PrayerTimesEntry(
                    date: prayerDate,
                    prayers: data.allPrayers,
                    currentPrayer: prayer.name,
                    hijriDate: hijri,
                    isPlaceholder: false
                ))
            }
        }

        // Also an entry for "now"
        if let current = makeEntry() {
            entries.insert(current, at: 0)
        }

        let midnight = Calendar.current.startOfDay(for: Date()).addingTimeInterval(86400)
        completion(Timeline(
            entries: entries.sorted { $0.date < $1.date },
            policy: .after(midnight)
        ))
    }

    private func makeEntry() -> PrayerTimesEntry? {
        guard let data = SharedPrayerData.load() else { return nil }
        let hijri = [data.hijriDay, data.hijriMonth, data.hijriYear]
            .filter { !$0.isEmpty }
            .joined(separator: " ")

        return PrayerTimesEntry(
            date: Date(),
            prayers: data.allPrayers,
            currentPrayer: data.currentPrayer(),
            hijriDate: hijri,
            isPlaceholder: false
        )
    }
}

// MARK: - Widget View

struct PrayerTimesWidgetView: View {
    var entry: PrayerTimesEntry

    let goldColor = Color(red: 201/255, green: 162/255, blue: 39/255)
    let bgDark = Color(red: 26/255, green: 26/255, blue: 46/255)
    let bgMedium = Color(red: 22/255, green: 33/255, blue: 62/255)

    let prayerEmojis: [String: String] = [
        "Fajr": "🌅", "Dhuhr": "☀️", "Asr": "🌤️", "Maghrib": "🌇", "Isha": "🌙"
    ]

    var body: some View {
        VStack(spacing: 4) {
            // Header
            HStack {
                Text("🕌 El Mohsinine")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(goldColor)
                Spacer()
                if !entry.hijriDate.isEmpty {
                    Text(entry.hijriDate)
                        .font(.system(size: 9))
                        .foregroundColor(.white.opacity(0.5))
                }
            }

            Divider()
                .background(Color.white.opacity(0.15))

            // Prayer rows
            ForEach(entry.prayers, id: \.name) { prayer in
                let isCurrent = prayer.name == entry.currentPrayer

                HStack(spacing: 0) {
                    Text(prayerEmojis[prayer.name] ?? "")
                        .font(.system(size: 11))
                        .frame(width: 18)

                    Text(prayer.name)
                        .font(.system(size: 12, weight: isCurrent ? .bold : .regular))
                        .foregroundColor(isCurrent ? goldColor : .white)
                        .frame(width: 55, alignment: .leading)

                    Text(prayer.adhan)
                        .font(.system(size: 12, weight: .semibold, design: .monospaced))
                        .foregroundColor(isCurrent ? goldColor : .white.opacity(0.9))

                    Spacer()

                    if !prayer.iqama.isEmpty {
                        Text("Iqama \(prayer.iqama)")
                            .font(.system(size: 10))
                            .foregroundColor(.white.opacity(0.5))
                    }
                }
                .padding(.vertical, 1)
                .padding(.horizontal, 4)
                .background(
                    isCurrent
                        ? RoundedRectangle(cornerRadius: 4)
                            .fill(Color.white.opacity(0.08))
                        : nil
                )
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            LinearGradient(
                gradient: Gradient(colors: [bgDark, bgMedium]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
    }
}

// MARK: - Widget Configuration

struct PrayerTimesWidget: Widget {
    let kind: String = "PrayerTimesWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PrayerTimesProvider()) { entry in
            if #available(iOSApplicationExtension 17.0, *) {
                PrayerTimesWidgetView(entry: entry)
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                PrayerTimesWidgetView(entry: entry)
            }
        }
        .configurationDisplayName("Horaires de Prière")
        .description("Les 5 prières du jour avec iqama — El Mouhssinine")
        .supportedFamilies([.systemMedium])
    }
}
