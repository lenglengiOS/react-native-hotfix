#import "HotfixBundle.h"

#import "HotfixLaunchManager.h"

@implementation HotfixBundle

+ (nullable NSURL *)currentBundleURLWithFallbackURL:(nullable NSURL *)fallbackURL
{
  HotfixLaunchSelection *selection = [[HotfixLaunchManager shared] prepareLaunch];
  return selection.bundleURL ?: fallbackURL;
}

@end
