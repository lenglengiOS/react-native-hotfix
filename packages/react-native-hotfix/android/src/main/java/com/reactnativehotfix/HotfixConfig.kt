package com.reactnativehotfix

import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager

data class HotfixConfig(
  val manifestUrl: String?,
  val publicKey: String?,
  val channel: String,
  val runtimeVersion: String,
  val enableInDebug: Boolean,
  val allowCleartext: Boolean,
) {
  val isConfigured: Boolean
    get() = !manifestUrl.isNullOrBlank() && !publicKey.isNullOrBlank()

  val isDebugBuild: Boolean
    get() = debugBuild

  private var debugBuild: Boolean = false

  companion object {
    private const val PREFIX = "com.reactnativehotfix."

    fun from(context: Context): HotfixConfig {
      val applicationInfo = context.applicationInfo
      val metadata = applicationInfo.metaData
      val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
      val versionName = packageInfo.versionName ?: "1.0.0"
      val config = HotfixConfig(
        manifestUrl = metadata?.getString("${PREFIX}MANIFEST_URL"),
        publicKey = metadata?.getString("${PREFIX}PUBLIC_KEY"),
        channel = metadata?.getString("${PREFIX}CHANNEL") ?: "production",
        runtimeVersion = metadata?.getString("${PREFIX}RUNTIME_VERSION") ?: versionName,
        enableInDebug = metadata?.getBoolean("${PREFIX}ENABLE_IN_DEBUG", false) ?: false,
        allowCleartext = metadata?.getBoolean("${PREFIX}ALLOW_CLEARTEXT", false) ?: false,
      )
      config.debugBuild =
        applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
      return config
    }
  }
}
