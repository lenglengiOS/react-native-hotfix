#import <Foundation/Foundation.h>

#import "HotfixConfig.h"

NS_ASSUME_NONNULL_BEGIN

@interface HotfixAssetDescriptor : NSObject

@property (nonatomic, copy) NSString *path;
@property (nonatomic, copy) NSString *hash;
@property (nonatomic, assign) long long size;
@property (nonatomic, copy) NSString *contentType;

@end

@interface HotfixManifest : NSObject

@property (nonatomic, copy) NSString *identifier;
@property (nonatomic, copy) NSString *createdAt;
@property (nonatomic, copy) NSString *runtimeVersion;
@property (nonatomic, copy) NSString *channel;
@property (nonatomic, copy) NSString *platform;
@property (nonatomic, strong) HotfixAssetDescriptor *launchAsset;
@property (nonatomic, copy) NSArray<HotfixAssetDescriptor *> *assets;
@property (nonatomic, copy) NSDictionary *metadata;
@property (nonatomic, assign) NSInteger maxFailedLaunches;

+ (nullable instancetype)manifestWithPayload:(NSString *)payload
                                      config:(HotfixConfig *)config
                                       error:(NSError **)error;
- (NSDictionary *)updateInfo;

@end

@interface HotfixLaunchSelection : NSObject

@property (nonatomic, copy) NSString *updateIdentifier;
@property (nonatomic, strong) NSURL *bundleURL;
@property (nonatomic, copy) NSString *launchType;
@property (nonatomic, copy) NSDictionary *updateInfo;

@end

@interface HotfixLaunchManager : NSObject

@property (nonatomic, strong, readonly) HotfixConfig *config;

+ (instancetype)shared;
- (nullable HotfixLaunchSelection *)prepareLaunch;
- (void)markReady;
- (NSDictionary *)state;
- (nullable NSString *)currentUpdateIdentifier;
- (void)installManifest:(HotfixManifest *)manifest
         stagedDirectory:(NSURL *)stagedDirectory
                   error:(NSError **)error;
- (NSURL *)updatesDirectoryWithError:(NSError **)error;
- (nullable NSURL *)safeURLInDirectory:(NSURL *)directory
                            relativePath:(NSString *)relativePath
                                   error:(NSError **)error;
- (void)clearDownloads;
- (NSString *)installationIdentifier;

@end

NS_ASSUME_NONNULL_END
