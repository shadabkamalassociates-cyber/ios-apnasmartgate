package com.kamalassociates.aapnasmartgate

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class VisitorLaunchModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  init {
    VisitorLaunchStore.registerModule(this)
  }

  override fun getName(): String = "VisitorLaunchBridge"

  @ReactMethod
  fun consumeInitialVisitorPayload(promise: Promise) {
    val payload = VisitorLaunchStore.consumeInitialPayload()
    promise.resolve(payload?.let { Arguments.fromBundle(it) })
  }

  @ReactMethod
  fun showVisitorAlert(payload: ReadableMap, promise: Promise) {
    try {
      val extras = Arguments.toBundle(payload)
      val intent = Intent(reactContext, VisitorAlertActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        if (extras != null) {
          putExtras(extras)
        }
      }

      reactContext.startActivity(intent)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("VISITOR_ALERT_OPEN_FAILED", e)
    }
  }

  @ReactMethod
  fun isBatteryOptimizationDisabled(promise: Promise) {
    try {
      val pm = reactContext.getSystemService(Context.POWER_SERVICE) as PowerManager
      val isIgnoring = pm.isIgnoringBatteryOptimizations(reactContext.packageName)
      promise.resolve(isIgnoring)
    } catch (e: Exception) {
      promise.reject("BATTERY_CHECK_FAILED", e)
    }
  }

  @ReactMethod
  fun requestIgnoreBatteryOptimization(promise: Promise) {
    try {
      val pm = reactContext.getSystemService(Context.POWER_SERVICE) as PowerManager
      if (pm.isIgnoringBatteryOptimizations(reactContext.packageName)) {
        promise.resolve(true)
        return
      }
      val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
        data = Uri.parse("package:${reactContext.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(intent)
      promise.resolve(false)
    } catch (e: Exception) {
      promise.reject("BATTERY_OPT_REQUEST_FAILED", e)
    }
  }

  @ReactMethod
  fun canUseFullScreenIntent(promise: Promise) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      val nm = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      promise.resolve(nm.canUseFullScreenIntent())
    } else {
      promise.resolve(true)
    }
  }

  @ReactMethod
  fun openFullScreenIntentSettings(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        val intent = Intent(
          Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
          Uri.parse("package:${reactContext.packageName}")
        ).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactContext.startActivity(intent)
      } else {
        val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
          putExtra(Settings.EXTRA_APP_PACKAGE, reactContext.packageName)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactContext.startActivity(intent)
      }
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("OPEN_SETTINGS_FAILED", e)
    }
  }

  @ReactMethod
  fun storeVisitorAlertPayload(payload: ReadableMap, promise: Promise) {
    try {
      val bundle = Arguments.toBundle(payload)
      VisitorLaunchStore.setPendingAlertData(bundle)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("STORE_FAILED", e)
    }
  }

  @ReactMethod
  fun cancelAllNotifications(promise: Promise) {
    try {
      val nm = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.cancelAll()
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("CANCEL_FAILED", e)
    }
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Required by NativeEventEmitter.
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required by NativeEventEmitter.
  }

  fun emitVisitorLaunch(payload: android.os.Bundle) {
    if (!reactContext.hasActiveReactInstance()) return

    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("visitorLaunchOpened", Arguments.fromBundle(payload))
  }
}
