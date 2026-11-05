#import "HotfixInstaller.h"

#import <CommonCrypto/CommonDigest.h>
#import <Security/Security.h>

static NSString *const HotfixInstallerErrorDomain = @"ReactNativeHotfixInstaller";

static NSError *InstallerError(NSInteger code, NSString *message)
{
  return [NSError errorWithDomain:HotfixInstallerErrorDomain
                             code:code
                         userInfo:@{NSLocalizedDescriptionKey : message}];
}

@implementation HotfixInstaller

+ (NSDictionary *)checkAndInstallWithConfig:(HotfixConfig *)config
                                  manager:(HotfixLaunchManager *)manager
                                    error:(NSError **)error
{
  if (![config isConfigured]) {
    if (error) {
      *error = InstallerError(1, @"Hotfix is not configured");
    }
    return nil;
  }
  if (![config isEnabledInCurrentBuild]) {
    return @{@"status" : @"disabled"};
  }

  NSDictionary *checked = [self fetchManifestWithConfig:config manager:manager error:error];
  if (!checked) {
    return error && *error ? nil : @{@"status" : @"no-update"};
  }

  NSString *payloadBase64 = checked[@"payload"];
  NSData *payloadData = [[NSData alloc] initWithBase64EncodedString:payloadBase64 options:0];
  if (!payloadData || ![self verifyPayload:payloadData
                                  signature:checked[@"signature"]
                                  publicKey:config.publicKey
                                   expectedKeyId:checked[@"keyId"]
                                          error:error]) {
    if (error && !*error) {
      *error = InstallerError(2, @"Update signature is invalid");
    }
    return nil;
  }
  NSString *payload = [[NSString alloc] initWithData:payloadData encoding:NSUTF8StringEncoding];
  HotfixManifest *manifest = [HotfixManifest manifestWithPayload:payload config:config error:error];
  if (!manifest) {
    return nil;
  }

  NSString *assetBase = [checked[@"assetBaseUrl"] stringByTrimmingCharactersInSet:
    [NSCharacterSet characterSetWithCharactersInString:@"/"]];
  NSURL *staging = [[manager updatesDirectoryWithError:error]
    URLByAppendingPathComponent:[NSString stringWithFormat:@".staging-%@", [NSUUID UUID].UUIDString]];
  if (!staging || ![[NSFileManager defaultManager] createDirectoryAtURL:staging
                                             withIntermediateDirectories:YES
                                                              attributes:nil
                                                                   error:error]) {
    return nil;
  }

  NSMutableArray<HotfixAssetDescriptor *> *descriptors = [NSMutableArray arrayWithObject:
    manifest.launchAsset];
  [descriptors addObjectsFromArray:manifest.assets];
  for (HotfixAssetDescriptor *descriptor in descriptors) {
    NSURL *target = [manager safeURLInDirectory:staging
                                   relativePath:descriptor.path
                                          error:error];
    if (!target || ![[NSFileManager defaultManager] createDirectoryAtURL:
      [target URLByDeletingLastPathComponent]
                                             withIntermediateDirectories:YES
                                                              attributes:nil
                                                                   error:error]) {
      return nil;
    }
    NSString *encodedPath = [self encodePath:descriptor.path];
    NSURL *assetURL = [NSURL URLWithString:
      [NSString stringWithFormat:@"%@/%@", assetBase, encodedPath]];
    NSData *assetData = [self requestURL:assetURL headers:@{
      @"Accept" : descriptor.contentType,
    } maxBytes:(NSUInteger)descriptor.size error:error];
    if (!assetData || ![self data:assetData matchesDescriptor:descriptor]) {
      if (error && !*error) {
        *error = InstallerError(3, [NSString stringWithFormat:
          @"Downloaded file failed verification: %@", descriptor.path]);
      }
      [[NSFileManager defaultManager] removeItemAtURL:staging error:nil];
      return nil;
    }
    if (![assetData writeToURL:target options:NSDataWritingAtomic error:error]) {
      [[NSFileManager defaultManager] removeItemAtURL:staging error:nil];
      return nil;
    }
  }

  if (![payloadData writeToURL:[staging URLByAppendingPathComponent:@"manifest.json"]
                       options:NSDataWritingAtomic
                         error:error]) {
    [[NSFileManager defaultManager] removeItemAtURL:staging error:nil];
    return nil;
  }
  [manager installManifest:manifest stagedDirectory:staging error:error];
  if (error && *error) {
    [[NSFileManager defaultManager] removeItemAtURL:staging error:nil];
    return nil;
  }
  return @{
    @"status" : @"downloaded",
    @"update" : [manifest updateInfo],
  };
}

+ (nullable NSDictionary *)fetchManifestWithConfig:(HotfixConfig *)config
                                           manager:(HotfixLaunchManager *)manager
                                             error:(NSError **)error
{
  NSURLComponents *components = [NSURLComponents componentsWithURL:config.manifestURL
                                            resolvingAgainstBaseURL:NO];
  NSArray *query = @[
    [NSURLQueryItem queryItemWithName:@"channel" value:config.channel],
    [NSURLQueryItem queryItemWithName:@"runtimeVersion" value:config.runtimeVersion],
    [NSURLQueryItem queryItemWithName:@"platform" value:@"ios"],
  ];
  components.queryItems = [[components.queryItems ?: @[] arrayByAddingObjectsFromArray:query]
    filteredArrayUsingPredicate:[NSPredicate predicateWithBlock:^BOOL(NSURLQueryItem *item,
                                                                       NSDictionary *bindings) {
      return item.value.length > 0;
    }]];
  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:components.URL];
  request.timeoutInterval = 15;
  [request setValue:@"application/json" forHTTPHeaderField:@"Accept"];
  [request setValue:@"1" forHTTPHeaderField:@"x-hotfix-protocol-version"];
  [request setValue:@"ios" forHTTPHeaderField:@"x-hotfix-platform"];
  [request setValue:config.runtimeVersion forHTTPHeaderField:@"x-hotfix-runtime-version"];
  [request setValue:config.channel forHTTPHeaderField:@"x-hotfix-channel"];
  [request setValue:[manager installationIdentifier] forHTTPHeaderField:@"x-hotfix-client-id"];
  NSString *currentUpdateIdentifier = [manager currentUpdateIdentifier];
  if (currentUpdateIdentifier.length > 0) {
    [request setValue:currentUpdateIdentifier forHTTPHeaderField:@"x-hotfix-current-update-id"];
  }

  NSData *data = [self requestDataForRequest:request maxBytes:1024 * 1024 error:error];
  if (!data) {
    return nil;
  }
  id json = [NSJSONSerialization JSONObjectWithData:data options:0 error:error];
  if (![json isKindOfClass:[NSDictionary class]]) {
    if (error) {
      *error = InstallerError(4, @"Update service returned invalid JSON");
    }
    return nil;
  }
  return json;
}

+ (nullable NSData *)requestURL:(NSURL *)url
                        headers:(NSDictionary<NSString *, NSString *> *)headers
                       maxBytes:(NSUInteger)maxBytes
                          error:(NSError **)error
{
  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.timeoutInterval = 30;
  for (NSString *key in headers) {
    [request setValue:headers[key] forHTTPHeaderField:key];
  }
  return [self requestDataForRequest:request maxBytes:maxBytes error:error];
}

+ (nullable NSData *)requestDataForRequest:(NSURLRequest *)request
                                  maxBytes:(NSUInteger)maxBytes
                                     error:(NSError **)error
{
  if (![self validateURL:request.URL error:error]) {
    return nil;
  }
  __block NSData *result = nil;
  __block NSHTTPURLResponse *httpResponse = nil;
  __block NSError *requestError = nil;
  dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
  NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request
    completionHandler:^(NSData *data, NSURLResponse *response, NSError *taskError) {
      result = data;
      httpResponse = [response isKindOfClass:[NSHTTPURLResponse class]]
        ? (NSHTTPURLResponse *)response
        : nil;
      requestError = taskError;
      dispatch_semaphore_signal(semaphore);
    }];
  [task resume];
  dispatch_semaphore_wait(semaphore, dispatch_time(DISPATCH_TIME_NOW, 45 * NSEC_PER_SEC));
  if (requestError) {
    if (error) {
      *error = requestError;
    }
    return nil;
  }
  if (!httpResponse) {
    if (error) {
      *error = InstallerError(5, @"Update service returned no HTTP response");
    }
    return nil;
  }
  if (![self validateURL:httpResponse.URL error:error]) {
    return nil;
  }
  if (httpResponse.statusCode == 204) {
    return nil;
  }
  if (httpResponse.statusCode != 200) {
    if (error) {
      *error = InstallerError(6, [NSString stringWithFormat:
        @"Update request failed with HTTP %ld", (long)httpResponse.statusCode]);
    }
    return nil;
  }
  if (result.length > maxBytes) {
    if (error) {
      *error = InstallerError(7, @"Update response exceeds its declared size");
    }
    return nil;
  }
  return result;
}

+ (BOOL)validateURL:(NSURL *)url error:(NSError **)error
{
  HotfixConfig *config = [HotfixConfig current];
  if ([url.scheme isEqual:@"https"]) {
    return YES;
  }
  BOOL local = [url.host isEqual:@"localhost"] || [url.host isEqual:@"127.0.0.1"];
#if DEBUG
  if ([url.scheme isEqual:@"http"] && config.allowCleartext && local) {
    return YES;
  }
#endif
  if (error) {
    *error = InstallerError(8, @"Hotfix requires HTTPS outside an allowed local development build");
  }
  return NO;
}

+ (BOOL)verifyPayload:(NSData *)payload
            signature:(NSDictionary *)signature
            publicKey:(NSString *)publicKey
         expectedKeyId:(NSString *)expectedKeyId
                error:(NSError **)error
{
  if (![signature[@"algorithm"] isEqual:@"rsa-sha256"] ||
      ![signature[@"value"] isKindOfClass:[NSString class]]) {
    if (error) {
      *error = InstallerError(2, @"Unsupported update signature algorithm");
    }
    return NO;
  }
  NSString *normalized = [[publicKey
    stringByReplacingOccurrencesOfString:@"-----BEGIN PUBLIC KEY-----" withString:@""]
    stringByReplacingOccurrencesOfString:@"-----END PUBLIC KEY-----" withString:@""];
  normalized = [[normalized componentsSeparatedByCharactersInSet:
    [NSCharacterSet whitespaceAndNewlineCharacterSet]] componentsJoinedByString:@""];
  NSData *keyData = [[NSData alloc] initWithBase64EncodedString:normalized options:0];
  NSData *signatureData = [[NSData alloc] initWithBase64EncodedString:signature[@"value"]
                                                              options:0];
  if (!keyData || !signatureData) {
    return NO;
  }
  unsigned char keyDigest[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256(keyData.bytes, (CC_LONG)keyData.length, keyDigest);
  NSMutableString *actualKeyId = [NSMutableString string];
  for (NSUInteger index = 0; index < 8; index += 1) {
    [actualKeyId appendFormat:@"%02x", keyDigest[index]];
  }
  if (![actualKeyId isEqualToString:expectedKeyId]) {
    if (error) {
      *error = InstallerError(2, @"Update was signed by an unexpected key");
    }
    return NO;
  }
  NSDictionary *attributes = @{
    (__bridge id)kSecAttrKeyType : (__bridge id)kSecAttrKeyTypeRSA,
    (__bridge id)kSecAttrKeyClass : (__bridge id)kSecAttrKeyClassPublic,
  };
  CFErrorRef keyError = NULL;
  SecKeyRef key = SecKeyCreateWithData((__bridge CFDataRef)keyData,
                                       (__bridge CFDictionaryRef)attributes,
                                       &keyError);
  if (!key) {
    if (error && keyError) {
      *error = CFBridgingRelease(keyError);
    }
    return NO;
  }
  BOOL valid = SecKeyVerifySignature(
    key,
    kSecKeyAlgorithmRSASignatureMessagePKCS1v15SHA256,
    (__bridge CFDataRef)payload,
    (__bridge CFDataRef)signatureData,
    NULL);
  CFRelease(key);
  return valid;
}

+ (BOOL)data:(NSData *)data matchesDescriptor:(HotfixAssetDescriptor *)descriptor
{
  if (data.length != descriptor.size) {
    return NO;
  }
  unsigned char digest[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256(data.bytes, (CC_LONG)data.length, digest);
  NSMutableString *hash = [NSMutableString stringWithString:@"sha256:"];
  for (NSUInteger index = 0; index < CC_SHA256_DIGEST_LENGTH; index += 1) {
    [hash appendFormat:@"%02x", digest[index]];
  }
  return [hash isEqualToString:descriptor.hash];
}

+ (NSString *)encodePath:(NSString *)path
{
  NSArray *components = [path componentsSeparatedByString:@"/"];
  NSMutableArray *encoded = [NSMutableArray array];
  for (NSString *component in components) {
    NSString *value = [component stringByAddingPercentEncodingWithAllowedCharacters:
      [NSCharacterSet URLPathAllowedCharacterSet]];
    [encoded addObject:value ?: @""];
  }
  return [encoded componentsJoinedByString:@"/"];
}

@end
