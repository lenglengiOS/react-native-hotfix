#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

#import "HotfixInstaller.h"
#import "HotfixLaunchManager.h"

#ifdef RCT_NEW_ARCH_ENABLED
#import <ReactNativeHotfixSpec/ReactNativeHotfixSpec.h>
#endif

@interface RCTNativeHotfixModule : NSObject <RCTBridgeModule
#ifdef RCT_NEW_ARCH_ENABLED
  , NativeHotfixModuleSpec
#endif
>
@end

@implementation RCTNativeHotfixModule

RCT_EXPORT_MODULE(NativeHotfixModule)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (void)getState:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  @try {
    resolve([[HotfixLaunchManager shared] state]);
  } @catch (NSException *exception) {
    reject(@"E_HOTFIX_STATE", exception.reason, nil);
  }
}

- (void)downloadAndInstall:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSError *error = nil;
    NSDictionary *result = [HotfixInstaller checkAndInstallWithConfig:
      [HotfixLaunchManager shared].config
                                                               manager:[HotfixLaunchManager shared]
                                                                 error:&error];
    if (result) {
      resolve(result);
    } else if (error) {
      reject(@"E_HOTFIX_DOWNLOAD", error.localizedDescription, error);
    } else {
      resolve(@{@"status" : @"no-update"});
    }
  });
}

- (void)markReady:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  @try {
    [[HotfixLaunchManager shared] markReady];
    resolve(nil);
  } @catch (NSException *exception) {
    reject(@"E_HOTFIX_READY", exception.reason, nil);
  }
}

- (void)clearDownloads:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  @try {
    [[HotfixLaunchManager shared] clearDownloads];
    resolve(nil);
  } @catch (NSException *exception) {
    reject(@"E_HOTFIX_CLEAR", exception.reason, nil);
  }
}

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
  (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeHotfixModuleSpecJSI>(params);
}
#endif

@end
