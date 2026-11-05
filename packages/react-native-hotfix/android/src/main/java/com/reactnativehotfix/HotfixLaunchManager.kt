package com.reactnativehotfix

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.util.UUID

internal data class HotfixLaunchSelection(
  val updateId: String,
  val bundleFile: File,
  val launchType: String,
  val updateInfo: JSONObject,
)

internal class HotfixLaunchManager(
  context: Context,
  val config: HotfixConfig,
) {
  private val files = HotfixFileSystem(context)
  private var selection: HotfixLaunchSelection? = null
  private var initialized = false

  @Synchronized
  fun prepareLaunch(): HotfixLaunchSelection? {
    if (initialized) {
      return selection
    }
    initialized = true
    if (!config.isConfigured || (config.isDebugBuild && !config.enableInDebug)) {
      return null
    }
    files.ensureDirectories()

    val state = files.readState()
    var currentId = state.nullableString("currentUpdateId")
    var previousId = state.nullableString("previousUpdateId")
    var failedLaunches = state.optInt("failedLaunches", 0)
    var rollbackCount = state.optInt("rollbackCount", 0)
    var fallbackOccurred = false

    while (currentId != null) {
      val candidate = loadCandidate(currentId)
      if (candidate == null) {
        fallbackOccurred = true
        currentId = previousId
        previousId = null
        failedLaunches = 0
        state.put("lastError", "Downloaded update files are missing")
        continue
      }

      if (state.optString("status") == "pending") {
        failedLaunches += 1
        if (failedLaunches > candidate.manifest.maxFailedLaunches) {
          fallbackOccurred = true
          rollbackCount += 1
          currentId = previousId
          previousId = null
          failedLaunches = 0
          state.put("lastError", "Update failed to start and was rolled back")
          continue
        }
      }

      state
        .put("currentUpdateId", currentId)
        .put("previousUpdateId", previousId)
        .put("status", "pending")
        .put("failedLaunches", failedLaunches)
        .put("rollbackCount", rollbackCount)
      files.writeState(state)
      selection = HotfixLaunchSelection(
        updateId = candidate.manifest.id,
        bundleFile = candidate.bundleFile,
        launchType = "update",
        updateInfo = candidate.manifest.updateJson(),
      )
      return selection
    }

    state
      .put("currentUpdateId", JSONObject.NULL)
      .put("previousUpdateId", JSONObject.NULL)
      .put("status", if (fallbackOccurred) "fallback" else "ready")
      .put("failedLaunches", 0)
      .put("rollbackCount", rollbackCount)
    files.writeState(state)
    return null
  }

  @Synchronized
  fun markReady() {
    val launched = selection ?: return
    val state = files.readState()
    if (state.nullableString("currentUpdateId") == launched.updateId) {
      state
        .put("status", "ready")
        .put("failedLaunches", 0)
      files.writeState(state)
    }
  }

  @Synchronized
  fun install(manifest: HotfixManifest, stagedDirectory: File): JSONObject {
    files.ensureDirectories()
    val destination = files.updateDirectory(manifest.id)
    if (destination.exists()) {
      destination.deleteRecursively()
    }
    check(stagedDirectory.renameTo(destination)) {
      "Unable to activate downloaded update"
    }

    val state = files.readState()
    val currentUpdateId = state.nullableString("currentUpdateId")
    state
      .put("previousUpdateId", currentUpdateId ?: JSONObject.NULL)
      .put("currentUpdateId", manifest.id)
      .put("status", "pending")
      .put("failedLaunches", 0)
      .put("lastError", JSONObject.NULL)
    files.writeState(state)

    val keep = setOf(
      manifest.id,
      currentUpdateId,
    ).filterNotNull()
    files.updates.listFiles()
      ?.filter { it.isDirectory && it.name !in keep }
      ?.sortedByDescending { it.lastModified() }
      ?.drop(1)
      ?.forEach { it.deleteRecursively() }

    return manifest.updateJson()
  }

  @Synchronized
  fun stateJson(): JSONObject {
    val state = files.readState()
    val currentId = state.nullableString("currentUpdateId")
    val downloaded = currentId?.let { loadCandidate(it)?.manifest?.updateJson() }
    val selectionAtLaunch = selection
    val launchType = selectionAtLaunch?.launchType ?: "embedded"
    return JSONObject()
      .put("currentUpdate", selectionAtLaunch?.updateInfo ?: JSONObject.NULL)
      .put("downloadedUpdate", downloaded ?: JSONObject.NULL)
      .put("launchType", launchType)
      .put("status", state.optString("status", "ready"))
      .put("failedLaunches", state.optInt("failedLaunches", 0))
      .put("rollbackCount", state.optInt("rollbackCount", 0))
      .put("lastError", state.opt("lastError") ?: JSONObject.NULL)
  }

  @Synchronized
  fun clearDownloads() {
    val state = files.readState()
    val keep = listOfNotNull(
      state.nullableString("currentUpdateId"),
      selection?.updateId,
    ).toSet()
    files.updates.listFiles()
      ?.filter { it.isDirectory && it.name !in keep }
      ?.forEach { it.deleteRecursively() }
    state.put("previousUpdateId", JSONObject.NULL)
    files.writeState(state)
  }

  fun installationId(context: Context): String {
    val preferences = context.getSharedPreferences("react-native-hotfix", Context.MODE_PRIVATE)
    return preferences.getString("installationId", null) ?: UUID.randomUUID().toString().also {
      preferences.edit().putString("installationId", it).apply()
    }
  }

  fun updatesDirectory(): File {
    files.ensureDirectories()
    return files.updates
  }

  @Synchronized
  fun currentUpdateIdentifier(): String? {
    return files.readState().nullableString("currentUpdateId")
  }

  fun fileInStagedUpdate(directory: File, relativePath: String): File {
    HotfixFileSystem.requireSafePath(relativePath)
    val root = directory.canonicalFile
    val file = File(root, relativePath).canonicalFile
    require(file.path.startsWith(root.path + File.separator)) {
      "Update file path escapes staging directory"
    }
    return file
  }

  private data class Candidate(
    val manifest: HotfixManifest,
    val bundleFile: File,
  )

  private fun loadCandidate(updateId: String): Candidate? {
    return try {
      val directory = files.updateDirectory(updateId)
      val manifestFile = File(directory, "manifest.json")
      if (!manifestFile.exists()) {
        return null
      }
      val manifest = HotfixManifest.parse(manifestFile.readText(), config)
      val bundleFile = files.fileInUpdate(updateId, manifest.launchAsset.path)
      if (!bundleFile.isFile) {
        return null
      }
      Candidate(manifest, bundleFile)
    } catch (_: Exception) {
      null
    }
  }

  private fun JSONObject.nullableString(key: String): String? {
    return if (isNull(key)) null else optString(key).takeIf { it.isNotBlank() }
  }
}
