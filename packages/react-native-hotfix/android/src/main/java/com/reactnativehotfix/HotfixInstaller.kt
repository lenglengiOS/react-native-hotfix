package com.reactnativehotfix

import android.content.Context
import android.util.Base64
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.util.UUID

internal class HotfixInstaller(
  private val context: Context,
  private val config: HotfixConfig,
  private val launchManager: HotfixLaunchManager,
) {
  fun checkAndDownload(): JSONObject {
    if (!config.isConfigured) {
      throw IllegalStateException("Hotfix is not configured")
    }
    if (config.isDebugBuild && !config.enableInDebug) {
      return JSONObject().put("status", "disabled")
    }

    val checked = fetchManifest()
    if (checked == null) {
      return JSONObject().put("status", "no-update")
    }

    val payloadBytes = Base64.decode(checked.getString("payload"), Base64.DEFAULT)
    verifySignature(
      payloadBytes,
      checked.getJSONObject("signature"),
      checked.getString("keyId"),
    )
    val payload = payloadBytes.toString(StandardCharsets.UTF_8)
    val manifest = HotfixManifest.parse(payload, config)
    val assetBaseUrl = checked.getString("assetBaseUrl").trimEnd('/')
    val staging = File(
      launchManager.updatesDirectory(),
      ".staging-${UUID.randomUUID()}",
    )
    check(staging.mkdirs()) { "Unable to create update staging directory" }

    try {
      val descriptors = listOf(manifest.launchAsset) + manifest.assets
      descriptors.forEach { descriptor ->
        val target = launchManager.fileInStagedUpdate(staging, descriptor.path)
        target.parentFile?.mkdirs()
        download(
          url = "$assetBaseUrl/${encodePath(descriptor.path)}",
          target = target,
          descriptor = descriptor,
        )
      }
      File(staging, "manifest.json").writeText(payload, StandardCharsets.UTF_8)
      val update = launchManager.install(manifest, staging)
      return JSONObject()
        .put("status", "downloaded")
        .put("update", update)
    } catch (error: Throwable) {
      staging.deleteRecursively()
      throw error
    }
  }

  private fun fetchManifest(): JSONObject? {
    val query = listOf(
      "channel" to config.channel,
      "runtimeVersion" to config.runtimeVersion,
      "platform" to "android",
    ).joinToString("&") { "${urlEncode(it.first)}=${urlEncode(it.second)}" }
    val connection = openConnection("${config.manifestUrl}?$query")
    connection.requestMethod = "GET"
    connection.setRequestProperty("accept", "application/json")
    connection.setRequestProperty("x-hotfix-protocol-version", "1")
    connection.setRequestProperty("x-hotfix-platform", "android")
    connection.setRequestProperty("x-hotfix-runtime-version", config.runtimeVersion)
    connection.setRequestProperty("x-hotfix-channel", config.channel)
    launchManager.currentUpdateIdentifier()?.let {
      connection.setRequestProperty("x-hotfix-current-update-id", it)
    }
    connection.setRequestProperty(
      "x-hotfix-client-id",
      launchManager.installationId(context),
    )

    return try {
      val status = connection.responseCode
      if (status == HttpURLConnection.HTTP_NO_CONTENT) {
        return null
      }
      if (status != HttpURLConnection.HTTP_OK) {
        val message = connection.errorStream?.bufferedReader()?.use { it.readText() }
          ?.take(500)
        throw IllegalStateException("Update check failed with HTTP $status: $message")
      }
      val bytes = connection.inputStream.use { input ->
        val data = input.readBytesLimited(1024 * 1024 + 1)
        require(data.size <= 1024 * 1024) { "Update manifest is too large" }
        data
      }
      JSONObject(bytes.toString(StandardCharsets.UTF_8))
    } finally {
      connection.disconnect()
    }
  }

  private fun verifySignature(
    payload: ByteArray,
    signature: JSONObject,
    expectedKeyId: String,
  ) {
    require(signature.optString("algorithm") == "rsa-sha256") {
      "Unsupported update signature algorithm"
    }
    val keyBytes = publicKeyBytes(config.publicKey ?: error("Missing public key"))
    val actualKeyId = MessageDigest.getInstance("SHA-256")
      .digest(keyBytes)
      .take(8)
      .joinToString("") { "%02x".format(it) }
    require(actualKeyId == expectedKeyId) {
      "Update was signed by an unexpected key"
    }
    val publicKey = KeyFactory.getInstance("RSA")
      .generatePublic(X509EncodedKeySpec(keyBytes))
    val verifier = Signature.getInstance("SHA256withRSA")
    verifier.initVerify(publicKey)
    verifier.update(payload)
    check(verifier.verify(Base64.decode(signature.getString("value"), Base64.DEFAULT))) {
      "Update manifest signature is invalid"
    }
  }

  private fun download(url: String, target: File, descriptor: HotfixAsset) {
    val connection = openConnection(url)
    connection.requestMethod = "GET"
    connection.setRequestProperty("accept", descriptor.contentType)
    try {
      val status = connection.responseCode
      check(status == HttpURLConnection.HTTP_OK) {
        "Update file download failed with HTTP $status: ${descriptor.path}"
      }
      val digest = MessageDigest.getInstance("SHA-256")
      var received = 0L
      BufferedInputStream(connection.inputStream).use { input ->
        FileOutputStream(target).use { output ->
          val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
          while (true) {
            val count = input.read(buffer)
            if (count < 0) {
              break
            }
            received += count
            require(received <= descriptor.size) {
              "Update file exceeds declared size: ${descriptor.path}"
            }
            digest.update(buffer, 0, count)
            output.write(buffer, 0, count)
          }
          output.fd.sync()
        }
      }
      check(received == descriptor.size) {
        "Update file size mismatch: ${descriptor.path}"
      }
      val actualHash = "sha256:${digest.digest().joinToString("") { "%02x".format(it) }}"
      check(actualHash == descriptor.hash) {
        "Update file hash mismatch: ${descriptor.path}"
      }
    } finally {
      connection.disconnect()
    }
  }

  private fun openConnection(url: String): HttpURLConnection {
    val parsed = URI(url).toURL()
    validateURL(parsed)
    return (parsed.openConnection() as HttpURLConnection).apply {
      instanceFollowRedirects = false
      connectTimeout = 15_000
      readTimeout = 30_000
      useCaches = false
    }
  }

  private fun validateURL(url: URL) {
    val protocol = url.protocol.lowercase()
    check(protocol == "https" || protocol == "http") {
      "Hotfix requires an HTTP(S) URL"
    }
    if (protocol == "http") {
      val host = url.host
      val local = host == "127.0.0.1" ||
        host == "localhost" ||
        host == "10.0.2.2" ||
        host == "::1"
      check(config.allowCleartext && (local || config.isDebugBuild)) {
        "Cleartext hotfix URLs require ALLOW_CLEARTEXT and a development host"
      }
    }
  }

  private fun publicKeyBytes(value: String): ByteArray {
    val normalized = value
      .replace("-----BEGIN PUBLIC KEY-----", "")
      .replace("-----END PUBLIC KEY-----", "")
      .replace(Regex("\\s"), "")
    return Base64.decode(normalized, Base64.DEFAULT)
  }

  private fun encodePath(path: String): String {
    return path.split('/').joinToString("/") { urlEncode(it) }
  }

  private fun urlEncode(value: String): String {
    return URLEncoder.encode(value, StandardCharsets.UTF_8.name())
      .replace("+", "%20")
  }

  private fun java.io.InputStream.readBytesLimited(limit: Int): ByteArray {
    val output = java.io.ByteArrayOutputStream()
    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
    while (true) {
      val count = read(buffer)
      if (count < 0) {
        break
      }
      output.write(buffer, 0, count)
      require(output.size() <= limit) { "Response is too large" }
    }
    return output.toByteArray()
  }
}
