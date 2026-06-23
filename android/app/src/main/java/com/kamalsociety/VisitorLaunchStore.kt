package com.kamalsociety

import android.content.Intent
import android.os.Bundle
import java.lang.ref.WeakReference

object VisitorLaunchStore {
  private var initialPayload: Bundle? = null
  private var moduleRef: WeakReference<VisitorLaunchModule>? = null

  @Volatile
  private var pendingAlertData: Bundle? = null

  fun registerModule(module: VisitorLaunchModule) {
    moduleRef = WeakReference(module)
  }

  fun setPendingAlertData(data: Bundle?) {
    pendingAlertData = data
  }

  fun consumePendingAlertData(): Bundle? {
    val data = pendingAlertData
    pendingAlertData = null
    return data
  }

  fun captureIntent(intent: Intent?, emitToJs: Boolean) {
    val payload = extractVisitorPayload(intent?.extras) ?: return
    initialPayload = Bundle(payload)

    if (emitToJs) {
      moduleRef?.get()?.emitVisitorLaunch(payload)
    }
  }

  fun consumeInitialPayload(): Bundle? {
    val payload = initialPayload ?: return null
    initialPayload = null
    return Bundle(payload)
  }

  private fun extractVisitorPayload(bundle: Bundle?): Bundle? {
    if (bundle == null) return null

    val visitorId =
      findString(
        bundle,
        "visitorId",
        "visitor_id",
        "gatepassId",
        "gatepass_id",
        "attendanceId",
        "attendance_id",
        "id"
      ) ?: return null

    val payload = Bundle().apply {
      putString("visitorId", visitorId)
    }

    findString(bundle, "visitorAction")?.let { payload.putString("visitorAction", it) }
    findString(bundle, "title")?.let { payload.putString("title", it) }
    findString(bundle, "body")?.let { payload.putString("body", it) }
    findString(bundle, "name")?.let { payload.putString("name", it) }
    findString(bundle, "flat", "flatNo")?.let { payload.putString("flat", it) }
    findString(bundle, "phone")?.let { payload.putString("phone", it) }
    findString(bundle, "vehicle", "vehicleinfo")?.let { payload.putString("vehicle", it) }

    return payload
  }

  @Suppress("DEPRECATION")
  private fun findString(bundle: Bundle?, vararg keys: String): String? {
    if (bundle == null) return null

    for (key in keys) {
      val value = bundle.get(key)
      when (value) {
        is String -> if (value.isNotBlank()) return value
        is Number -> return value.toString()
      }
    }

    for (entryKey in bundle.keySet()) {
      when (val value = bundle.get(entryKey)) {
        is Bundle -> {
          val nested = findString(value, *keys)
          if (!nested.isNullOrBlank()) return nested
        }
        is ArrayList<*> -> {
          value.forEach { item ->
            if (item is Bundle) {
              val nested = findString(item, *keys)
              if (!nested.isNullOrBlank()) return nested
            }
          }
        }
      }
    }

    return null
  }
}
