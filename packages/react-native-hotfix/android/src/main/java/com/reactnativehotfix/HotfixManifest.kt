package com.reactnativehotfix

import org.json.JSONObject

internal data class HotfixAsset(
  val path: String,
  val hash: String,
  val size: Long,
  val contentType: String,
  val url: String? = null,
)

internal data class HotfixManifest(
  val id: String,
  val createdAt: String,
  val runtimeVersion: String,
  val channel: String,
  val platform: String,
  val launchAsset: HotfixAsset,
  val assets: List<HotfixAsset>,
  val metadata: JSONObject,
  val maxFailedLaunches: Int,
) {
  fun updateJson(): JSONObject {
    return JSONObject()
      .put("id", id)
      .put("createdAt", createdAt)
      .put("runtimeVersion", runtimeVersion)
      .put("channel", channel)
      .put("metadata", metadata)
  }

  companion object {
    private val ID_PATTERN = Regex("^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$")
    private val HASH_PATTERN = Regex("^sha256:[a-f0-9]{64}$")
    private val RUNTIME_PATTERN = Regex("^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$")

    fun parse(payload: String, config: HotfixConfig): HotfixManifest {
      val root = JSONObject(payload)
      require(root.optInt("protocolVersion", -1) == 1) {
        "Unsupported update protocol"
      }
      val id = root.getString("id")
      require(ID_PATTERN.matches(id)) { "Invalid update id" }
      val runtimeVersion = root.getString("runtimeVersion")
      require(RUNTIME_PATTERN.matches(runtimeVersion)) {
        "Invalid runtime version"
      }
      require(runtimeVersion == config.runtimeVersion) {
        "Update runtime version does not match this app"
      }
      val channel = root.getString("channel")
      require(channel == config.channel) { "Update channel does not match this app" }
      require(root.getString("platform") == "android") {
        "Update platform does not match this app"
      }
      val launchAsset = parseAsset(root.getJSONObject("launchAsset"))
      val assetsJson = root.getJSONArray("assets")
      val assets = buildList {
        for (index in 0 until assetsJson.length()) {
          add(parseAsset(assetsJson.getJSONObject(index)))
        }
      }
      val paths = mutableSetOf(launchAsset.path)
      assets.forEach {
        require(paths.add(it.path)) { "Duplicate update file path" }
      }
      val rollback = root.optJSONObject("rollback")
      val maxFailedLaunches = rollback?.optInt("maxFailedLaunches", 2) ?: 2
      require(maxFailedLaunches in 1..10) {
        "Invalid rollback policy"
      }

      return HotfixManifest(
        id = id,
        createdAt = root.getString("createdAt"),
        runtimeVersion = runtimeVersion,
        channel = channel,
        platform = "android",
        launchAsset = launchAsset,
        assets = assets,
        metadata = root.optJSONObject("metadata") ?: JSONObject(),
        maxFailedLaunches = maxFailedLaunches,
      )
    }

    private fun parseAsset(json: JSONObject): HotfixAsset {
      val path = json.getString("path")
      HotfixFileSystem.requireSafePath(path)
      val hash = json.getString("hash")
      require(HASH_PATTERN.matches(hash)) { "Invalid update file hash" }
      val size = json.getLong("size")
      require(size >= 0) { "Invalid update file size" }
      val contentType = json.getString("contentType")
      require(contentType.isNotBlank()) { "Invalid update content type" }
      return HotfixAsset(path, hash, size, contentType)
    }
  }
}
