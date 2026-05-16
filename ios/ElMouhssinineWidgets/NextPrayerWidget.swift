import WidgetKit
import SwiftUI

// MARK: - Timeline Entry

struct NextPrayerEntry: TimelineEntry {
    let date: Date
    let prayerName: String
    let adhanTime: String
    let iqamaTime: String
    let prayerDate: Date?
    let hijriDate: String
    let isPlaceholder: Bool

    static var placeholder: NextPrayerEntry {
        NextPrayerEntry(
            date: Date(),
            prayerName: "Asr",
            adhanTime: "16:42",
            iqamaTime: "17:00",
            prayerDate: nil,
            hijriDate: "15 Ramadan 1447",
            isPlaceholder: true
        )
    }
}

// MARK: - Timeline Provider

struct NextPrayerProvider: TimelineProvider {
    func placeholder(in context: Context) -> NextPrayerEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (NextPrayerEntry) -> Void) {
        completion(makeEntry() ?? .placeholder)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NextPrayerEntry>) -> Void) {
        guard let data = SharedPrayerData.load() else {
            let entry = NextPrayerEntry.placeholder
            completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(900))))
            return
        }

        // Create entries for each prayer transition
        var entries: [NextPrayerEntry] = []
        let prayers = data.allPrayers

        for i in 0..<prayers.count {
            let prayer = prayers[i]
            guard let prayerDate = data.timeToDate(prayer.adhan) else { continue }

            // Entry at this prayer time → next prayer becomes the new "next"
            let nextIndex = (i + 1) % prayers.count
            let next = prayers[nextIndex]
            let nextDate = data.timeToDate(next.adhan)

            let hijri = [data.hijriDay, data.hijriMonth, data.hijriYear]
                .filter { !$0.isEmpty }
                .joined(separator: " ")

            entries.append(NextPrayerEntry(
                date: prayerDate,
                prayerName: next.name,
                adhanTime: next.adhan,
                iqamaTime: next.iqama,
                prayerDate: nextDate,
                hijriDate: hijri,
                isPlaceholder: false
            ))
        }

        // Also add an entry for "now"
        if let current = makeEntry() {
            entries.insert(current, at: 0)
        }

        // Refresh at midnight for next day
        let midnight = Calendar.current.startOfDay(for: Date()).addingTimeInterval(86400)
        completion(Timeline(
            entries: entries.sorted { $0.date < $1.date },
            policy: .after(midnight)
        ))
    }

    private func makeEntry() -> NextPrayerEntry? {
        guard let data = SharedPrayerData.load(),
              let next = data.nextPrayer() else { return nil }

        let hijri = [data.hijriDay, data.hijriMonth, data.hijriYear]
            .filter { !$0.isEmpty }
            .joined(separator: " ")

        return NextPrayerEntry(
            date: Date(),
            prayerName: next.name,
            adhanTime: next.adhan,
            iqamaTime: next.iqama,
            prayerDate: next.date,
            hijriDate: hijri,
            isPlaceholder: false
        )
    }
}

// MARK: - Widget Views

struct NextPrayerWidgetView: View {
    var entry: NextPrayerEntry

    let prayerEmojis: [String: String] = [
        "Fajr": "🌅", "Dhuhr": "☀️", "Asr": "🌤️", "Maghrib": "🌇", "Isha": "🌙"
    ]

    let goldColor = Color(red: 201/255, green: 162/255, blue: 39/255)

    var body: some View {
        VStack(spacing: 6) {
            // Prayer emoji + name
            Text("\(prayerEmojis[entry.prayerName] ?? "🕌") \(entry.prayerName)")
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(.white)

            // Countdown
            if let prayerDate = entry.prayerDate {
                Text(prayerDate, style: .relative)
                    .font(.system(size: 28, weight: .heavy, design: .rounded))
                    .foregroundColor(goldColor)
                    .minimumScaleFactor(0.6)
            }

            // Adhan time
            Text(entry.adhanTime)
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(.white.opacity(0.9))

            // Iqama
            if !entry.iqamaTime.isEmpty {
                Text("Iqama \(entry.iqamaTime)")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.white.opacity(0.6))
            }

            // Hijri date
            if !entry.hijriDate.isEmpty {
                Text(entry.hijriDate)
                    .font(.system(size: 10))
                    .foregroundColor(.white.opacity(0.5))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(12)
        .background(
            LinearGradient(
                gradient: Gradient(colors: [
                    Color(red: 26/255, green: 26/255, blue: 46/255),
                    Color(red: 22/255, green: 33/255, blue: 62/255),
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
    }
}

// MARK: - Lock Screen Widgets

@available(iOSApplicationExtension 16.0, *)
struct NextPrayerCircularView: View {
    var entry: NextPrayerEntry
    let goldColor = Color(red: 201/255, green: 162/255, blue: 39/255)

    var body: some View {
        VStack(spacing: 1) {
            Text(entry.prayerName.prefix(3).uppercased())
                .font(.system(size: 10, weight: .bold))
            Text(entry.adhanTime)
                .font(.system(size: 14, weight: .heavy))
                .foregroundColor(goldColor)
        }
        .widgetAccentable()
    }
}

@available(iOSApplicationExtension 16.0, *)
struct NextPrayerRectangularView: View {
    var entry: NextPrayerEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(entry.prayerName) \(entry.adhanTime)")
                .font(.system(size: 14, weight: .bold))
                .widgetAccentable()
            if !entry.iqamaTime.isEmpty {
                Text("Iqama \(entry.iqamaTime)")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
            }
            if let prayerDate = entry.prayerDate {
                Text(prayerDate, style: .relative)
                    .font(.system(size: 12, weight: .medium))
            }
        }
    }
}

@available(iOSApplicationExtension 16.0, *)
struct NextPrayerInlineView: View {
    var entry: NextPrayerEntry

    var body: some View {
        if let prayerDate = entry.prayerDate {
            Text("🕌 \(entry.prayerName) \(entry.adhanTime) — ")
            + Text(prayerDate, style: .relative)
        } else {
            Text("🕌 \(entry.prayerName) \(entry.adhanTime)")
        }
    }
}

// MARK: - Widget Configuration

struct NextPrayerWidget: Widget {
    let kind: String = "NextPrayerWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NextPrayerProvider()) { entry in
            if #available(iOSApplicationExtension 17.0, *) {
                NextPrayerWidgetView(entry: entry)
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                NextPrayerWidgetView(entry: entry)
            }
        }
        .configurationDisplayName("Prochain Salat")
        .description("Countdown vers la prochaine prière — El Mouhssinine")
        .supportedFamilies(supportedFamilies)
    }

    private var supportedFamilies: [WidgetFamily] {
        var families: [WidgetFamily] = [.systemSmall]
        if #available(iOSApplicationExtension 16.0, *) {
            families.append(contentsOf: [
                .accessoryCircular,
                .accessoryRectangular,
                .accessoryInline,
            ])
        }
        return families
    }
}
