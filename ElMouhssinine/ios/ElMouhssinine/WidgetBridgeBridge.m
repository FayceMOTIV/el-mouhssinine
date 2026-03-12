#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WidgetBridge, NSObject)
RCT_EXTERN_METHOD(updatePrayerData:(NSDictionary *)prayerData)
RCT_EXTERN_METHOD(updateAnnouncements:(NSArray *)announcements)
RCT_EXTERN_METHOD(reloadWidgets)
@end
