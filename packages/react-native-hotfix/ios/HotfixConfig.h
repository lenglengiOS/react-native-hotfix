#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface HotfixConfig : NSObject

@property (nonatomic, copy, nullable) NSURL *manifestURL;
@property (nonatomic, copy, nullable) NSString *publicKey;
@property (nonatomic, copy) NSString *channel;
@property (nonatomic, copy) NSString *runtimeVersion;
@property (nonatomic, assign) BOOL enableInDebug;
@property (nonatomic, assign) BOOL allowCleartext;

+ (instancetype)current;

- (BOOL)isConfigured;
- (BOOL)isEnabledInCurrentBuild;

@end

NS_ASSUME_NONNULL_END
