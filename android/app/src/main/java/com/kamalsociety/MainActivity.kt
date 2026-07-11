package com.kamalsociety

import android.content.Intent
import android.os.Bundle
import androidx.core.app.ActivityCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.PermissionListener

class MainActivity : ReactActivity() {
  private var mPermListener: PermissionListener? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    VisitorLaunchStore.captureIntent(intent, emitToJs = false)
  }

  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    setIntent(intent)
    VisitorLaunchStore.captureIntent(intent, emitToJs = true)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "AapnaSmartGate"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName)

  // Workaround: ReactActivityDelegate.onRequestPermissionsResult calls
  // getReactNativeHost() which crashes in the New Architecture (bridgeless).
  // We intercept the permission flow and forward results directly to the
  // PermissionListener set by the PermissionsAndroid TurboModule.
  override fun requestPermissions(permissions: Array<String>, requestCode: Int, listener: PermissionListener?) {
    mPermListener = listener
    ActivityCompat.requestPermissions(this, permissions, requestCode)
  }

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<String>,
    grantResults: IntArray
  ) {
    mPermListener?.let {
      if (it.onRequestPermissionsResult(requestCode, permissions, grantResults)) {
        mPermListener = null
      }
    }
  }
}
