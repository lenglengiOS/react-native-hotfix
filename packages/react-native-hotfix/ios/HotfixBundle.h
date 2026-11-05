#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface HotfixBundle : NSObject

+ (nullable NSURL *)currentBundleURLWithFallbackURL:(nullable NSURL *)fallbackURL;

@end

NS_ASSUME_NONNULL_END
