package expo.modules.arthikautolog

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.provider.Telephony
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ArthikAutoLogModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ArthikAutoLog")

    Function("isAvailable") { true }

    // ── Capture switch (signed out / paused → receivers drop everything) ──
    Function("setCaptureEnabled") { enabled: Boolean -> EventQueue.setCaptureEnabled(context, enabled) }
    Function("isCaptureEnabled") { EventQueue.isCaptureEnabled(context) }
    Function("getLastEventAt") { EventQueue.lastEventAt(context).toDouble() }
    Function("setEmailEnabled") { enabled: Boolean -> EventQueue.setEmailEnabled(context, enabled) }
    Function("isEmailEnabled") { EventQueue.isEmailEnabled(context) }

    // ── Queue ──
    Function("drainQueue") { EventQueue.drain(context) }
    Function("getQueueSize") { EventQueue.size(context) }
    Function("clearQueue") { EventQueue.clear(context) }

    // ── SMS inbox (discovery / recovery / catch-up). Only financial SMS leave native. ──
    AsyncFunction("countSms") { sinceMs: Double, untilMs: Double ->
      var count = 0
      context.contentResolver.query(
        Telephony.Sms.Inbox.CONTENT_URI,
        arrayOf(Telephony.Sms._ID),
        "${Telephony.Sms.DATE} >= ? AND ${Telephony.Sms.DATE} < ?",
        arrayOf(sinceMs.toLong().toString(), untilMs.toLong().toString()),
        null
      )?.use { c -> count = c.count }
      count
    }

    AsyncFunction("readSmsPage") { sinceMs: Double, beforeMs: Double, pageSize: Int ->
      val messages = ArrayList<Map<String, Any?>>()
      var scanned = 0
      var oldest = beforeMs
      context.contentResolver.query(
        Telephony.Sms.Inbox.CONTENT_URI,
        arrayOf(Telephony.Sms._ID, Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE),
        "${Telephony.Sms.DATE} >= ? AND ${Telephony.Sms.DATE} < ?",
        arrayOf(sinceMs.toLong().toString(), beforeMs.toLong().toString()),
        "${Telephony.Sms.DATE} DESC"
      )?.use { c ->
        val iId = c.getColumnIndex(Telephony.Sms._ID)
        val iAddr = c.getColumnIndex(Telephony.Sms.ADDRESS)
        val iBody = c.getColumnIndex(Telephony.Sms.BODY)
        val iDate = c.getColumnIndex(Telephony.Sms.DATE)
        while (c.moveToNext() && scanned < pageSize) {
          scanned++
          val date = c.getLong(iDate)
          oldest = date.toDouble()
          val addr = c.getString(iAddr)
          val body = c.getString(iBody)
          if (FinancialFilter.isFinancialSms(addr, body)) {
            messages.add(mapOf(
              "id" to c.getLong(iId).toString(),
              "address" to addr,
              "body" to body,
              "date" to date.toDouble()
            ))
          }
        }
      }
      mapOf("messages" to messages, "scanned" to scanned, "oldest" to oldest, "done" to (scanned < pageSize))
    }

    // ── Notification access ──
    Function("isNotificationListenerEnabled") {
      val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: ""
      flat.contains(context.packageName)
    }

    Function("openNotificationListenerSettings") {
      val ctx = context
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS).putExtra(
          Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
          ComponentName(ctx, PaymentNotificationListener::class.java).flattenToString()
        )
      } else {
        Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        ctx.startActivity(intent)
      } catch (_: Exception) {
        ctx.startActivity(Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }

    // ── Battery ──
    Function("isIgnoringBatteryOptimizations") {
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    /** Opens App info, where Android 12+ shows "App battery usage → Unrestricted".
     *  (We deliberately do not use REQUEST_IGNORE_BATTERY_OPTIMIZATIONS — Play-restricted.) */
    Function("openAppDetails") {
      val ctx = context
      val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${ctx.packageName}"))
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(intent)
    }

    Function("openBatteryOptimizationList") {
      val ctx = context
      try {
        ctx.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      } catch (_: Exception) {
        ctx.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${ctx.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }
  }
}
