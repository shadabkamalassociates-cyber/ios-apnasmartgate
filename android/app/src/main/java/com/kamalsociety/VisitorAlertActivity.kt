package com.kamalsociety

import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationManagerCompat

class VisitorAlertActivity : AppCompatActivity() {
  private var mediaPlayer: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private var resolvedPayload: Bundle? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    configureWindow()
    setContentView(R.layout.activity_visitor_alert)
    bindIntent(intent)
    startAlerting()
    NotificationManagerCompat.from(this).cancelAll()
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    bindIntent(intent)
    startAlerting()
    NotificationManagerCompat.from(this).cancelAll()
  }

  override fun onDestroy() {
    stopAlerting()
    super.onDestroy()
  }

  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    dismissAlert()
  }

  private fun configureWindow() {
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
      )
    }
  }

  private fun bindIntent(intent: Intent?) {
    val extras = intent?.extras
    val pendingData = VisitorLaunchStore.consumePendingAlertData()

    fun resolve(vararg keys: String): String? =
      findExtra(extras, *keys) ?: findExtra(pendingData, *keys)

    resolvedPayload = Bundle().apply {
      resolve("title")?.let { putString("title", it) }
      resolve("body")?.let { putString("body", it) }
      resolve("name", "visitorName")?.let { putString("name", it) }
      resolve("flat", "flatNo")?.let { putString("flat", it) }
      resolve("phone")?.let { putString("phone", it) }
      resolve("vehicle", "vehicleinfo")?.let { putString("vehicle", it) }
      resolve("visitorId", "gatepassId", "requestId")?.let { putString("visitorId", it) }
    }

    val avatarView = findViewById<TextView>(R.id.visitorAlertAvatar)
    val titleView = findViewById<TextView>(R.id.visitorAlertTitle)
    val nameValue = findViewById<TextView>(R.id.visitorAlertNameValue)
    val phoneValue = findViewById<TextView>(R.id.visitorAlertPhoneValue)
    val vehicleValue = findViewById<TextView>(R.id.visitorAlertVehicleValue)
    val closeButton = findViewById<TextView>(R.id.visitorAlertCloseBtn)
    val approveButton = findViewById<Button>(R.id.visitorAlertApproveBtn)
    val rejectButton = findViewById<Button>(R.id.visitorAlertRejectBtn)

    titleView.text = resolve("title") ?: "Visitor Entry Request"
    
    val visitorName = resolve("name", "visitorName") ?: "-"
    nameValue.text = visitorName
    if (visitorName != "-" && visitorName.isNotEmpty()) {
        avatarView.text = visitorName.substring(0, 1).uppercase()
    } else {
        avatarView.text = "V"
    }

    phoneValue.text = resolve("phone") ?: "-"
    vehicleValue.text = resolve("vehicle", "vehicleinfo") ?: "-"

    closeButton.setOnClickListener { dismissAlert() }
    approveButton.setOnClickListener { dispatchAction("approve") }
    rejectButton.setOnClickListener { dispatchAction("unapprove") }
  }

  private fun dispatchAction(action: String) {
    stopAlerting()
    NotificationManagerCompat.from(this).cancelAll()

    val appIntent = Intent(this, MainActivity::class.java).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      resolvedPayload?.let { putExtras(Bundle(it)) }
      putExtra("visitorAction", action)
    }

    startActivity(appIntent)
    finish()
  }

  private fun dismissAlert() {
    stopAlerting()
    NotificationManagerCompat.from(this).cancelAll()
    finish()
  }

  private fun startAlerting() {
    stopAlerting()

    var alertUri = android.net.Uri.parse("android.resource://" + packageName + "/" + R.raw.mygate)
    if (alertUri == null) {
      alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
    }

    if (alertUri != null) {
      try {
        mediaPlayer = MediaPlayer().apply {
          setAudioAttributes(
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_ALARM)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build()
          )
          setDataSource(this@VisitorAlertActivity, alertUri)
          isLooping = true
          prepare()
          start()
        }
      } catch (e: Exception) {
        e.printStackTrace()
      }
    }

    vibrator = getSystemVibrator()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 900, 400, 900), 0))
    } else {
      @Suppress("DEPRECATION")
      vibrator?.vibrate(longArrayOf(0, 900, 400, 900), 0)
    }
  }

  private fun stopAlerting() {
    mediaPlayer?.runCatching {
      if (isPlaying) stop()
      release()
    }
    mediaPlayer = null

    vibrator?.cancel()
    vibrator = null
  }

  private fun getSystemVibrator(): Vibrator? {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val vibratorManager = getSystemService(VIBRATOR_MANAGER_SERVICE) as? VibratorManager
      vibratorManager?.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      getSystemService(VIBRATOR_SERVICE) as? Vibrator
    }
  }

  @Suppress("DEPRECATION")
  private fun findExtra(bundle: Bundle?, vararg keys: String): String? {
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
          val nested = findExtra(value, *keys)
          if (!nested.isNullOrBlank()) return nested
        }
      }
    }

    return null
  }
}
