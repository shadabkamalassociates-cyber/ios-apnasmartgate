package com.kamalsociety

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(VisitorLaunchPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    loadReactNative(this)
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channelId = getString(R.string.default_notification_channel_id)
      val channel = NotificationChannel(
        channelId,
        "Gate Pass Alerts",
        NotificationManager.IMPORTANCE_HIGH
      ).apply { 
        description = "Society and resident notifications" 
        
        val soundUri = android.net.Uri.parse("android.resource://" + packageName + "/" + R.raw.mygate)
        val audioAttributes = android.media.AudioAttributes.Builder()
            .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .build()
        setSound(soundUri, audioAttributes)
        enableVibration(true)
        vibrationPattern = longArrayOf(300, 600)
      }
      val manager = getSystemService(NotificationManager::class.java)
      manager?.createNotificationChannel(channel)
    }
  }
}
