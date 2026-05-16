#import <React/RCTBridgeModule.h>

// On garde RCT_EXTERN_MODULE pour start/stop (delegate au Swift)
// et on ajoute checkStatus en ObjC natif qui appelle la méthode Swift statique

@interface RCT_EXTERN_MODULE(MosqueGeofencing, NSObject)
RCT_EXTERN_METHOD(start)
RCT_EXTERN_METHOD(stop)
RCT_EXTERN_METHOD(checkStatus:(RCTResponseSenderBlock)callback)
RCT_EXTERN_METHOD(getPendingDeepLink:(RCTResponseSenderBlock)callback)
RCT_EXTERN_METHOD(clearPendingDeepLink)
@end
