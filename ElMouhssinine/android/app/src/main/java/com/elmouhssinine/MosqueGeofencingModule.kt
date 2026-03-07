package com.elmouhssinine

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingRequest
import com.google.android.gms.location.LocationServices

/**
 * React Native native module exposant start() et stop() au JS.
 * Utilise GeofencingClient pour enregistrer une zone circulaire
 * autour de la mosquée El Mouhssinine.
 */
class MosqueGeofencingModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val TAG = "MosqueGeofencing"
    private const val PREFS_NAME = "MosqueePrefs"
    private const val GEOFENCING_ENABLED_KEY = "geofencingEnabled"
    private const val MOSQUE_LAT = 46.2055668
    private const val MOSQUE_LNG = 5.2477947
    private const val MOSQUE_RADIUS = 200f
    private const val GEOFENCE_ID = "mosquee-el-mouhssinine"

    /**
     * Enregistre le geofence. Appelé par start() et par BootReceiver au reboot.
     */
    fun registerGeofence(context: Context) {
      val geofencingClient = LocationServices.getGeofencingClient(context)

      val geofence = Geofence.Builder()
        .setRequestId(GEOFENCE_ID)
        .setCircularRegion(MOSQUE_LAT, MOSQUE_LNG, MOSQUE_RADIUS)
        .setExpirationDuration(Geofence.NEVER_EXPIRE)
        .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER)
        .build()

      val request = GeofencingRequest.Builder()
        .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
        .addGeofence(geofence)
        .build()

      val pendingIntent = getPendingIntent(context)

      try {
        geofencingClient.addGeofences(request, pendingIntent)
          .addOnSuccessListener {
            Log.d(TAG, "Geofence enregistré (${MOSQUE_LAT}, ${MOSQUE_LNG}, ${MOSQUE_RADIUS}m)")
          }
          .addOnFailureListener { e ->
            Log.e(TAG, "Erreur enregistrement geofence: ${e.message}")
          }
      } catch (e: SecurityException) {
        Log.e(TAG, "Permission location manquante: ${e.message}")
      }
    }

    private fun getPendingIntent(context: Context): PendingIntent {
      val intent = Intent(context, MosqueGeofencingReceiver::class.java)
      val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      else
        PendingIntent.FLAG_UPDATE_CURRENT
      return PendingIntent.getBroadcast(context, 0, intent, flags)
    }
  }

  override fun getName() = "MosqueGeofencing"

  @ReactMethod
  fun start() {
    val context = reactApplicationContext
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit().putBoolean(GEOFENCING_ENABLED_KEY, true).apply()
    registerGeofence(context)
  }

  @ReactMethod
  fun stop() {
    val context = reactApplicationContext
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit().putBoolean(GEOFENCING_ENABLED_KEY, false).apply()

    try {
      LocationServices.getGeofencingClient(context)
        .removeGeofences(getPendingIntent(context))
        .addOnSuccessListener {
          Log.d(TAG, "Geofence supprimé")
        }
        .addOnFailureListener { e ->
          Log.e(TAG, "Erreur suppression geofence: ${e.message}")
        }
    } catch (e: SecurityException) {
      Log.e(TAG, "Permission manquante pour suppression: ${e.message}")
    }
  }
}
