package com.reactnativehotfix

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executors

@ReactModule(name = HotfixModule.NAME)
class HotfixModule(reactContext: ReactApplicationContext) :
  NativeHotfixModuleSpec(reactContext) {

  private val runtime = HotfixRuntime.get(reactContext)
  private val executor = Executors.newSingleThreadExecutor()

  override fun getName(): String = NAME

  override fun getState(promise: Promise) {
    try {
      promise.resolve(toWritableMap(runtime.launchManager.stateJson()))
    } catch (error: Throwable) {
      promise.reject("E_HOTFIX_STATE", error.message, error)
    }
  }

  override fun downloadAndInstall(promise: Promise) {
    executor.execute {
      try {
        val installer = HotfixInstaller(
          runtime.context,
          runtime.launchManager.config,
          runtime.launchManager,
        )
        promise.resolve(toWritableMap(installer.checkAndDownload()))
      } catch (error: Throwable) {
        promise.reject("E_HOTFIX_DOWNLOAD", error.message, error)
      }
    }
  }

  override fun markReady(promise: Promise) {
    try {
      runtime.launchManager.markReady()
      promise.resolve(null)
    } catch (error: Throwable) {
      promise.reject("E_HOTFIX_READY", error.message, error)
    }
  }

  override fun clearDownloads(promise: Promise) {
    try {
      runtime.launchManager.clearDownloads()
      promise.resolve(null)
    } catch (error: Throwable) {
      promise.reject("E_HOTFIX_CLEAR", error.message, error)
    }
  }

  override fun invalidate() {
    executor.shutdownNow()
    super.invalidate()
  }

  private fun toWritableMap(value: JSONObject): WritableMap {
    return jsonToAny(value) as WritableMap
  }

  private fun jsonToAny(value: Any?): Any? {
    return when (value) {
      null, JSONObject.NULL -> null
      is JSONObject -> Arguments.createMap().apply {
        value.keys().forEach { key ->
          when (val converted = jsonToAny(value.opt(key))) {
            is WritableMap -> putMap(key, converted)
            is com.facebook.react.bridge.WritableArray -> putArray(key, converted)
            is Boolean -> putBoolean(key, converted)
            is Int -> putInt(key, converted)
            is Long -> putDouble(key, converted.toDouble())
            is Double -> putDouble(key, converted)
            is String -> putString(key, converted)
            else -> putNull(key)
          }
        }
      }
      is JSONArray -> Arguments.createArray().apply {
        for (index in 0 until value.length()) {
          when (val converted = jsonToAny(value.opt(index))) {
            is WritableMap -> pushMap(converted)
            is com.facebook.react.bridge.WritableArray -> pushArray(converted)
            is Boolean -> pushBoolean(converted)
            is Int -> pushInt(converted)
            is Long -> pushDouble(converted.toDouble())
            is Double -> pushDouble(converted)
            is String -> pushString(converted)
            else -> pushNull()
          }
        }
      }
      else -> value
    }
  }

  companion object {
    const val NAME = "NativeHotfixModule"
  }
}
