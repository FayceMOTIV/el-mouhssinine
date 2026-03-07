package com.elmouhssinine

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Réenregistre le geofence après un reboot du device.
 * Android perd les geofences au reboot (contrairement à iOS).
 */
class MosqueGeofenceBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

    val prefs = context.getSharedPreferences("MosqueePrefs", Context.MODE_PRIVATE)
    val enabled = prefs.getBoolean("geofencingEnabled", false)
    if (enabled) {
      Log.d("MosqueGeofencing", "Boot: réenregistrement geofence")
      MosqueGeofencingModule.registerGeofence(context)
    }
  }
}
