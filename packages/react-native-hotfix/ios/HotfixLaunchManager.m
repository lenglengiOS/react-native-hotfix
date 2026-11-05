#import "HotfixLaunchManager.h"

static NSString *const HotfixErrorDomain = @"ReactNativeHotfix";

static NSError *HotfixError(NSInteger code, NSString *message)
{
  return [NSError errorWithDomain:HotfixErrorDomain
                             code:code
                         userInfo:@{NSLocalizedDescriptionKey : message}];
}

static BOOL HotfixSafeRelativePath(NSString *path)
{
  if (path.length == 0 || path.length > 512 || [path hasPrefix:@"/"] ||
      [path containsString:@"\\"] || [path containsString:@"\\0"]) {
    return NO;
  }
  for (NSString *component in [path componentsSeparatedByString:@"/"]) {
    if (component.length == 0 || [component isEqualToString:@"."] ||
        [component isEqualToString:@".."]) {
      return NO;
    }
  }
  return YES;
}

@implementation HotfixAssetDescriptor
@end

@interface HotfixManifest ()
+ (nullable HotfixAssetDescriptor *)assetFromJSON:(id)json error:(NSError **)error;
@end

@implementation HotfixManifest

+ (nullable instancetype)manifestWithPayload:(NSString *)payload
                                      config:(HotfixConfig *)config
                                       error:(NSError **)error
{
  NSData *data = [payload dataUsingEncoding:NSUTF8StringEncoding];
  id parsed = [NSJSONSerialization JSONObjectWithData:data options:0 error:error];
  if (![parsed isKindOfClass:[NSDictionary class]]) {
    if (error) {
      *error = HotfixError(1, @"Update manifest is not an object");
    }
    return nil;
  }
  NSDictionary *root = parsed;
  if (![root[@"id"] isKindOfClass:[NSString class]] ||
      ![root[@"createdAt"] isKindOfClass:[NSString class]] ||
      ![root[@"runtimeVersion"] isKindOfClass:[NSString class]] ||
      ![root[@"channel"] isKindOfClass:[NSString class]] ||
      ![root[@"assets"] isKindOfClass:[NSArray class]]) {
    if (error) {
      *error = HotfixError(8, @"Update manifest fields are invalid");
    }
    return nil;
  }
  if (![root[@"protocolVersion"] isEqual:@1]) {
    if (error) {
      *error = HotfixError(2, @"Unsupported update protocol");
    }
    return nil;
  }
  NSString *identifier = root[@"id"];
  NSRegularExpression *idPattern = [NSRegularExpression
    regularExpressionWithPattern:@"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$"
                         options:0
                           error:nil];
  if ([idPattern numberOfMatchesInString:identifier
                                  options:0
                                    range:NSMakeRange(0, identifier.length)] != 1 ||
      [root[@"createdAt"] isKindOfClass:[NSString class]] == NO ||
      [[NSISO8601DateFormatter new] dateFromString:root[@"createdAt"]] == nil) {
    if (error) {
      *error = HotfixError(8, @"Update manifest identity is invalid");
    }
    return nil;
  }
  if (![root[@"platform"] isEqual:@"ios"] ||
      ![root[@"runtimeVersion"] isEqual:config.runtimeVersion] ||
      ![root[@"channel"] isEqual:config.channel]) {
    if (error) {
      *error = HotfixError(3, @"Update is incompatible with this app");
    }
    return nil;
  }

  NSMutableSet<NSString *> *paths = [NSMutableSet set];
  HotfixAssetDescriptor *launchAsset = [self assetFromJSON:root[@"launchAsset"] error:error];
  if (!launchAsset) {
    return nil;
  }
  [paths addObject:launchAsset.path];

  NSMutableArray<HotfixAssetDescriptor *> *assets = [NSMutableArray array];
  for (id item in root[@"assets"]) {
    HotfixAssetDescriptor *asset = [self assetFromJSON:item error:error];
    if (!asset) {
      return nil;
    }
    if ([paths containsObject:asset.path]) {
      if (error) {
        *error = HotfixError(4, @"Duplicate update file path");
      }
      return nil;
    }
    [paths addObject:asset.path];
    [assets addObject:asset];
  }

  NSInteger maxFailed = 2;
  NSDictionary *rollback = root[@"rollback"];
  if ([rollback isKindOfClass:[NSDictionary class]] && rollback[@"maxFailedLaunches"]) {
    maxFailed = [rollback[@"maxFailedLaunches"] integerValue];
  }
  if (maxFailed < 1 || maxFailed > 10) {
    if (error) {
      *error = HotfixError(5, @"Invalid rollback policy");
    }
    return nil;
  }

  HotfixManifest *manifest = [HotfixManifest new];
  manifest.identifier = root[@"id"];
  manifest.createdAt = root[@"createdAt"];
  manifest.runtimeVersion = root[@"runtimeVersion"];
  manifest.channel = root[@"channel"];
  manifest.platform = root[@"platform"];
  manifest.launchAsset = launchAsset;
  manifest.assets = assets;
  manifest.metadata = [root[@"metadata"] isKindOfClass:[NSDictionary class]]
    ? root[@"metadata"]
    : @{};
  manifest.maxFailedLaunches = maxFailed;
  return manifest;
}

+ (nullable HotfixAssetDescriptor *)assetFromJSON:(id)json error:(NSError **)error
{
  if (![json isKindOfClass:[NSDictionary class]]) {
    if (error) {
      *error = HotfixError(6, @"Update asset descriptor is invalid");
    }
    return nil;
  }
  NSString *path = json[@"path"];
  NSString *hash = json[@"hash"];
  NSString *contentType = json[@"contentType"];
  NSNumber *size = json[@"size"];
  if (![path isKindOfClass:[NSString class]] ||
      ![hash isKindOfClass:[NSString class]] ||
      ![contentType isKindOfClass:[NSString class]] ||
      ![size isKindOfClass:[NSNumber class]]) {
    if (error) {
      *error = HotfixError(7, @"Update asset descriptor is invalid");
    }
    return nil;
  }
  NSRegularExpression *hashPattern = [NSRegularExpression
    regularExpressionWithPattern:@"^sha256:[a-f0-9]{64}$"
                         options:0
                           error:nil];
  NSRange hashRange = NSMakeRange(0, hash.length);
  if (!HotfixSafeRelativePath(path) ||
      [hashPattern numberOfMatchesInString:hash options:0 range:hashRange] != 1 ||
      size.longLongValue < 0 || contentType.length == 0) {
    if (error) {
      *error = HotfixError(7, @"Update asset descriptor is invalid");
    }
    return nil;
  }

  HotfixAssetDescriptor *asset = [HotfixAssetDescriptor new];
  asset.path = path;
  asset.hash = hash;
  asset.size = size.longLongValue;
  asset.contentType = contentType;
  return asset;
}

- (NSDictionary *)updateInfo
{
  return @{
    @"id" : self.identifier,
    @"createdAt" : self.createdAt,
    @"runtimeVersion" : self.runtimeVersion,
    @"channel" : self.channel,
    @"metadata" : self.metadata,
  };
}

@end

@implementation HotfixLaunchSelection
@end

@interface HotfixLaunchManager ()

@property (nonatomic, strong) HotfixConfig *config;
@property (nonatomic, strong) NSURL *rootURL;
@property (nonatomic, strong) NSURL *updatesURL;
@property (nonatomic, strong) NSURL *stateURL;
@property (nonatomic, strong, nullable) HotfixLaunchSelection *selection;
@property (nonatomic, assign) BOOL initialized;
@property (nonatomic, strong) NSLock *lock;

@end

@implementation HotfixLaunchManager

+ (instancetype)shared
{
  static HotfixLaunchManager *manager;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    manager = [HotfixLaunchManager new];
    manager.config = [HotfixConfig current];
    manager.lock = [NSLock new];
    NSURL *support = [[[NSFileManager defaultManager]
      URLsForDirectory:NSApplicationSupportDirectory
             inDomains:NSUserDomainMask] firstObject];
    NSURL *applicationDirectory = [support URLByAppendingPathComponent:
      [[NSBundle mainBundle] bundleIdentifier] ?: @"ReactNativeHotfix"];
    manager.rootURL = [applicationDirectory URLByAppendingPathComponent:@"hotfix"];
    manager.updatesURL = [manager.rootURL URLByAppendingPathComponent:@"updates"];
    manager.stateURL = [manager.rootURL URLByAppendingPathComponent:@"state.json"];
  });
  return manager;
}

- (nullable HotfixLaunchSelection *)prepareLaunch
{
  [self.lock lock];
  @try {
    if (self.initialized) {
      return self.selection;
    }
    self.initialized = YES;
    if (![self.config isEnabledInCurrentBuild]) {
      return nil;
    }
    NSError *directoryError;
    if (![self ensureDirectories:&directoryError]) {
      return nil;
    }

    NSMutableDictionary *state = [[self readState] mutableCopy];
    NSString *currentID = [self stringOrNil:state[@"currentUpdateId"]];
    NSString *previousID = [self stringOrNil:state[@"previousUpdateId"]];
    NSInteger failed = [state[@"failedLaunches"] integerValue];
    NSInteger rollbacks = [state[@"rollbackCount"] integerValue];

    while (currentID.length > 0) {
      NSDictionary *manifest = [self manifestForUpdate:currentID error:nil];
      if (!manifest) {
        currentID = previousID;
        previousID = nil;
        failed = 0;
        state[@"lastError"] = @"Downloaded update files are missing";
        continue;
      }
      if ([state[@"status"] isEqual:@"pending"]) {
        failed += 1;
        NSInteger maximum = [[manifest[@"rollback"] objectForKey:@"maxFailedLaunches"] integerValue];
        if (maximum == 0) {
          maximum = 2;
        }
        if (failed > maximum) {
          rollbacks += 1;
          currentID = previousID;
          previousID = nil;
          failed = 0;
          state[@"lastError"] = @"Update failed to start and was rolled back";
          continue;
        }
      }
      NSURL *bundleURL = [self bundleURLForManifest:manifest updateID:currentID];
      if (!bundleURL) {
        currentID = previousID;
        previousID = nil;
        continue;
      }
      state[@"currentUpdateId"] = currentID;
      state[@"previousUpdateId"] = previousID ?: [NSNull null];
      state[@"status"] = @"pending";
      state[@"failedLaunches"] = @(failed);
      state[@"rollbackCount"] = @(rollbacks);
      [self writeState:state];
      HotfixLaunchSelection *selection = [HotfixLaunchSelection new];
      selection.updateIdentifier = currentID;
      selection.bundleURL = bundleURL;
      selection.launchType = @"update";
      selection.updateInfo = [self updateInfoForManifest:manifest];
      self.selection = selection;
      return selection;
    }

    state[@"currentUpdateId"] = [NSNull null];
    state[@"previousUpdateId"] = [NSNull null];
    state[@"failedLaunches"] = @0;
    state[@"rollbackCount"] = @(rollbacks);
    if (state[@"status"] == nil || [state[@"status"] isEqual:@"pending"]) {
      state[@"status"] = failed > 0 ? @"fallback" : @"ready";
    }
    [self writeState:state];
    self.selection = nil;
    return nil;
  } @finally {
    [self.lock unlock];
  }
}

- (void)markReady
{
  [self.lock lock];
  @try {
    HotfixLaunchSelection *launched = self.selection;
    if (!launched) {
      return;
    }
    NSMutableDictionary *state = [[self readState] mutableCopy];
    if ([state[@"currentUpdateId"] isEqual:launched.updateIdentifier]) {
      state[@"status"] = @"ready";
      state[@"failedLaunches"] = @0;
      [self writeState:state];
    }
  } @finally {
    [self.lock unlock];
  }
}

- (NSDictionary *)state
{
  [self.lock lock];
  @try {
    NSDictionary *stored = [self readState];
    NSString *currentID = [self stringOrNil:stored[@"currentUpdateId"]];
    NSDictionary *downloadedManifest = currentID.length > 0
      ? [self manifestForUpdate:currentID error:nil]
      : nil;
    return @{
      @"currentUpdate" : self.selection.updateInfo ?: [NSNull null],
      @"downloadedUpdate" : downloadedManifest
        ? [self updateInfoForManifest:downloadedManifest]
        : [NSNull null],
      @"launchType" : self.selection.launchType ?: @"embedded",
      @"status" : stored[@"status"] ?: @"ready",
      @"failedLaunches" : stored[@"failedLaunches"] ?: @0,
      @"rollbackCount" : stored[@"rollbackCount"] ?: @0,
      @"lastError" : stored[@"lastError"] ?: [NSNull null],
    };
  } @finally {
    [self.lock unlock];
  }
}

- (nullable NSString *)currentUpdateIdentifier
{
  [self.lock lock];
  @try {
    return [self stringOrNil:[self readState][@"currentUpdateId"]];
  } @finally {
    [self.lock unlock];
  }
}

- (void)installManifest:(HotfixManifest *)manifest
         stagedDirectory:(NSURL *)stagedDirectory
                   error:(NSError **)error
{
  [self.lock lock];
  @try {
    NSError *directoryError;
    if (![self ensureDirectories:&directoryError]) {
      if (error) {
        *error = directoryError;
      }
      return;
    }
    NSURL *destination = [self.updatesURL URLByAppendingPathComponent:manifest.identifier];
    NSFileManager *fileManager = [NSFileManager defaultManager];
    if ([fileManager fileExistsAtPath:destination.path]) {
      [fileManager removeItemAtURL:destination error:nil];
    }
    if (![fileManager moveItemAtURL:stagedDirectory toURL:destination error:error]) {
      return;
    }
    NSMutableDictionary *state = [[self readState] mutableCopy];
    NSString *currentID = [self stringOrNil:state[@"currentUpdateId"]];
    state[@"previousUpdateId"] = currentID ?: [NSNull null];
    state[@"currentUpdateId"] = manifest.identifier;
    state[@"status"] = @"pending";
    state[@"failedLaunches"] = @0;
    state[@"lastError"] = [NSNull null];
    [self writeState:state];
  } @finally {
    [self.lock unlock];
  }
}

- (NSURL *)updatesDirectoryWithError:(NSError **)error
{
  if (![self ensureDirectories:error]) {
    return nil;
  }
  return self.updatesURL;
}

- (nullable NSURL *)safeURLInDirectory:(NSURL *)directory
                            relativePath:(NSString *)relativePath
                                   error:(NSError **)error
{
  if (!HotfixSafeRelativePath(relativePath)) {
    if (error) {
      *error = HotfixError(8, @"Invalid update file path");
    }
    return nil;
  }
  NSURL *target = directory;
  for (NSString *component in [relativePath componentsSeparatedByString:@"/"]) {
    target = [target URLByAppendingPathComponent:component];
  }
  NSString *rootPath = directory.URLByStandardizingPath.path;
  NSString *targetPath = target.URLByStandardizingPath.path;
  if (![targetPath hasPrefix:[rootPath stringByAppendingString:@"/"]]) {
    if (error) {
      *error = HotfixError(9, @"Update file path escapes update directory");
    }
    return nil;
  }
  return target;
}

- (void)clearDownloads
{
  [self.lock lock];
  @try {
    NSDictionary *state = [self readState];
    NSMutableSet *keep = [NSMutableSet set];
    NSString *current = [self stringOrNil:state[@"currentUpdateId"]];
    if (current.length > 0) {
      [keep addObject:current];
    }
    if (self.selection.updateIdentifier.length > 0) {
      [keep addObject:self.selection.updateIdentifier];
    }
    NSFileManager *fileManager = [NSFileManager defaultManager];
    for (NSURL *url in [fileManager contentsOfDirectoryAtURL:self.updatesURL
                                  includingPropertiesForKeys:nil
                                                     options:NSDirectoryEnumerationSkipsHiddenFiles
                                                       error:nil]) {
      if (![keep containsObject:url.lastPathComponent]) {
        [fileManager removeItemAtURL:url error:nil];
      }
    }
    NSMutableDictionary *updated = [state mutableCopy];
    updated[@"previousUpdateId"] = [NSNull null];
    [self writeState:updated];
  } @finally {
    [self.lock unlock];
  }
}

- (NSString *)installationIdentifier
{
  NSString *key = @"react-native-hotfix.installation-id";
  NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
  NSString *identifier = [defaults stringForKey:key];
  if (identifier.length == 0) {
    identifier = [[NSUUID UUID] UUIDString];
    [defaults setObject:identifier forKey:key];
  }
  return identifier;
}

- (BOOL)ensureDirectories:(NSError **)error
{
  return [[NSFileManager defaultManager] createDirectoryAtURL:self.updatesURL
                                  withIntermediateDirectories:YES
                                                   attributes:nil
                                                        error:error];
}

- (NSDictionary *)readState
{
  NSData *data = [NSData dataWithContentsOfURL:self.stateURL];
  if (!data) {
    return @{
      @"status" : @"ready",
      @"failedLaunches" : @0,
      @"rollbackCount" : @0,
    };
  }
  id value = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  return [value isKindOfClass:[NSDictionary class]]
    ? value
    : @{
        @"status" : @"ready",
        @"failedLaunches" : @0,
        @"rollbackCount" : @0,
      };
}

- (void)writeState:(NSDictionary *)state
{
  [[NSFileManager defaultManager] createDirectoryAtURL:self.rootURL
                           withIntermediateDirectories:YES
                                            attributes:nil
                                                 error:nil];
  NSData *data = [NSJSONSerialization dataWithJSONObject:state options:0 error:nil];
  [data writeToURL:self.stateURL options:NSDataWritingAtomic error:nil];
}

- (nullable NSDictionary *)manifestForUpdate:(NSString *)updateID error:(NSError **)error
{
  NSURL *directory = [self.updatesURL URLByAppendingPathComponent:updateID];
  NSData *data = [NSData dataWithContentsOfURL:
    [directory URLByAppendingPathComponent:@"manifest.json"]];
  if (!data) {
    return nil;
  }
  id manifest = [NSJSONSerialization JSONObjectWithData:data options:0 error:error];
  return [manifest isKindOfClass:[NSDictionary class]] ? manifest : nil;
}

- (nullable NSURL *)bundleURLForManifest:(NSDictionary *)manifest updateID:(NSString *)updateID
{
  NSDictionary *launchAsset = manifest[@"launchAsset"];
  NSString *path = launchAsset[@"path"];
  NSError *error;
  NSURL *bundleURL = [self safeURLInDirectory:
    [self.updatesURL URLByAppendingPathComponent:updateID]
                                  relativePath:path
                                         error:&error];
  if (!bundleURL || ![[NSFileManager defaultManager] fileExistsAtPath:bundleURL.path]) {
    return nil;
  }
  return bundleURL;
}

- (NSDictionary *)updateInfoForManifest:(NSDictionary *)manifest
{
  return @{
    @"id" : manifest[@"id"],
    @"createdAt" : manifest[@"createdAt"],
    @"runtimeVersion" : manifest[@"runtimeVersion"],
    @"channel" : manifest[@"channel"],
    @"metadata" : [manifest[@"metadata"] isKindOfClass:[NSDictionary class]]
      ? manifest[@"metadata"]
      : @{},
  };
}

- (nullable NSString *)stringOrNil:(id)value
{
  return [value isKindOfClass:[NSString class]] && [value length] > 0 ? value : nil;
}

@end
