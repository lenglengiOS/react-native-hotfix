package com.reactnativehotfix

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class HotfixPackage : BaseReactPackage() {
  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? {
    return when (name) {
      HotfixModule.NAME -> HotfixModule(reactContext)
      else -> null
    }
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      mapOf(
        HotfixModule.NAME to ReactModuleInfo(
          HotfixModule.NAME,
          HotfixModule::class.java.name,
          false,
          false,
          false,
          true,
        ),
      )
    }
  }
}
