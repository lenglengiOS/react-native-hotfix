package com.reactnativehotfix

import android.util.AtomicFile
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.nio.charset.StandardCharsets

internal class HotfixFileSystem(context: android.content.Context) {
  val root = File(context.noBackupFilesDir, "hotfix")
  val updates = File(root, "updates")
  val stateFile = File(root, "state.json")

  fun ensureDirectories() {
    check(updates.exists() || updates.mkdirs()) {
      "Unable to create update directory"
    }
  }

  fun readState(): JSONObject {
    if (!stateFile.exists()) {
      return JSONObject()
    }
    return try {
      JSONObject(stateFile.readText(StandardCharsets.UTF_8))
    } catch (_: Exception) {
      JSONObject()
    }
  }

  fun writeState(state: JSONObject) {
    root.mkdirs()
    val atomicFile = AtomicFile(stateFile)
    val stream: FileOutputStream = atomicFile.startWrite()
    try {
      stream.write(state.toString().toByteArray(StandardCharsets.UTF_8))
      stream.fd.sync()
      atomicFile.finishWrite(stream)
    } catch (error: Throwable) {
      atomicFile.failWrite(stream)
      throw error
    }
  }

  fun updateDirectory(updateId: String): File {
    requireSafePath(updateId)
    return File(updates, updateId)
  }

  fun fileInUpdate(updateId: String, relativePath: String): File {
    requireSafePath(relativePath)
    val rootPath = updateDirectory(updateId).canonicalFile
    val file = File(rootPath, relativePath).canonicalFile
    require(file.path.startsWith(rootPath.path + File.separator)) {
      "Update file path escapes update directory"
    }
    return file
  }

  fun readJson(file: File): JSONObject {
    return JSONObject(file.readText(StandardCharsets.UTF_8))
  }

  companion object {
    fun requireSafePath(relativePath: String) {
      require(relativePath.isNotEmpty() && relativePath.length <= 512) {
        "Invalid update path"
      }
      require(!relativePath.startsWith("/") && !relativePath.contains('\\')) {
        "Invalid update path"
      }
      require(
        relativePath.split('/').none {
          it.isEmpty() || it == "." || it == ".."
        },
      ) {
        "Invalid update path"
      }
    }
  }
}
