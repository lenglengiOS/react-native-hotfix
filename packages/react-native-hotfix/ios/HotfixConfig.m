#import "HotfixConfig.h"

@implementation HotfixConfig

+ (instancetype)current
{
  HotfixConfig *config = [HotfixConfig new];
  NSDictionary *info = [[NSBundle mainBundle] infoDictionary] ?: @{};
  NSString *manifestURL = info[@"HotfixManifestURL"];
  config.manifestURL = manifestURL.length > 0 ? [NSURL URLWithString:manifestURL] : nil;
  config.publicKey = info[@"HotfixPublicKey"];
  config.channel = [info[@"HotfixChannel"] isKindOfClass:[NSString class]]
    ? info[@"HotfixChannel"]
    : @"production";
  NSString *runtimeVersion = info[@"HotfixRuntimeVersion"];
  config.runtimeVersion = runtimeVersion.length > 0
    ? runtimeVersion
    : (info[@"CFBundleShortVersionString"] ?: @"1.0.0");
  config.enableInDebug = [info[@"HotfixEnableInDebug"] boolValue];
  config.allowCleartext = [info[@"HotfixAllowCleartext"] boolValue];
  return config;
}

- (BOOL)isConfigured
{
  return self.manifestURL != nil && self.publicKey.length > 0;
}

- (BOOL)isEnabledInCurrentBuild
{
  if (!self.isConfigured) {
    return NO;
  }
#if DEBUG
  return self.enableInDebug;
#else
  return YES;
#endif
}

@end
