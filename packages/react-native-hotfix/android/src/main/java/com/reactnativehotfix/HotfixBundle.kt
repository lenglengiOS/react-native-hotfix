package com.reactnativehotfix

import android.content.Context

object HotfixBundle {
  @JvmStatic
  fun getBundleFilePath(context: Context): String? {
    return HotfixRuntime.get(context).launchManager.prepareLaunch()?.bundleFile?.absolutePath
  }
}

internal object HotfixRuntime {
  @Volatile
  private var manager: HotfixLaunchManager? = null

  fun get(context: Context): Runtime {
    val applicationContext = context.applicationContext
    val existing = manager
    if (existing != null) {
      return Runtime(applicationContext, existing)
    }
    synchronized(this) {
      val created = manager ?: HotfixLaunchManager(
        applicationContext,
        HotfixConfig.from(applicationContext),
      ).also { manager = it }
      return Runtime(applicationContext, created)
    }
  }

  data class Runtime(
    val context: Context,
    val launchManager: HotfixLaunchManager,
  )
}
