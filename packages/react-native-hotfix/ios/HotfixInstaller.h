#import <Foundation/Foundation.h>

#import "HotfixLaunchManager.h"

NS_ASSUME_NONNULL_BEGIN

@interface HotfixInstaller : NSObject

+ (NSDictionary *)checkAndInstallWithConfig:(HotfixConfig *)config
                                  manager:(HotfixLaunchManager *)manager
                                    error:(NSError **)error;

@end

NS_ASSUME_NONNULL_END
