package com.elmouhssinine

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.GeofencingEvent
import com.google.android.gms.location.Geofence

/**
 * BroadcastReceiver statique déclaré dans AndroidManifest.xml.
 * Fonctionne même si l'app est tuée par Android.
 * Notification envoyée nativement en Kotlin (pas via JS).
 */
class MosqueGeofencingReceiver : BroadcastReceiver() {

  companion object {
    private const val TAG = "MosqueGeofencing"
    private const val CHANNEL_ID = "mosque-proximity"
    private const val PREFS_NAME = "MosqueePrefs"
    private const val LAST_NOTIF_KEY = "lastMosqueeNotif"
    private const val COOLDOWN_MS = 30 * 60 * 1000L // 30 minutes
    private const val NOTIF_ID = 42001
  }

  override fun onReceive(context: Context, intent: Intent) {
    val event = GeofencingEvent.fromIntent(intent)
    if (event == null) {
      Log.e(TAG, "GeofencingEvent null")
      return
    }
    if (event.hasError()) {
      Log.e(TAG, "GeofencingEvent error: ${event.errorCode}")
      return
    }
    if (event.geofenceTransition != Geofence.GEOFENCE_TRANSITION_ENTER) return

    // Cooldown 30 min via SharedPreferences
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val last = prefs.getLong(LAST_NOTIF_KEY, 0L)
    if (System.currentTimeMillis() - last < COOLDOWN_MS) {
      Log.d(TAG, "Cooldown active, skip notification")
      return
    }
    prefs.edit().putLong(LAST_NOTIF_KEY, System.currentTimeMillis()).apply()

    Log.d(TAG, "Entered mosque region, sending notification")
    sendNotification(context)
  }

  private fun sendNotification(context: Context) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    // Créer le channel (Android 8+)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Proximité mosquée",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Rappels quand vous êtes proche de la mosquée"
      }
      manager.createNotificationChannel(channel)
    }

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle("\uD83D\uDD4C Vous êtes à la mosquée")
      .setContentText("N'oubliez pas de mettre votre téléphone en mode silencieux \uD83D\uDD15")
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .build()

    manager.notify(NOTIF_ID, notification)
    Log.d(TAG, "Notification sent!")
  }
}
