package expo.modules.arthikautolog

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject

class PaymentNotificationListener : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return
    val emailApp = FinancialFilter.EMAIL_APPS[sbn.packageName] ?: return
    onEmailNotification(sbn, emailApp)
  }

  /**
   * Email app notification (Gmail, Outlook…). Only when the user turned on email detection.
   * Group-summary notifications ("3 new emails") are skipped: they don't describe one transaction.
   * The account address (subText) is never read.
   */
  private fun onEmailNotification(sbn: StatusBarNotification, app: String) {
    val ctx = applicationContext ?: return
    if (!EventQueue.isCaptureEnabled(ctx) || !EventQueue.isEmailEnabled(ctx)) return
    try {
      val n = sbn.notification ?: return
      if ((n.flags and Notification.FLAG_GROUP_SUMMARY) != 0) return
      val extras = n.extras ?: return
      val sender = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
      val body = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
        ?: extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
      if (!FinancialFilter.isFinancialEmail("$sender $body")) return
      val ev = JSONObject()
      ev.put("type", "email")
      ev.put("package", sbn.packageName)
      ev.put("app", app)
      ev.put("title", sender)
      ev.put("body", body)
      ev.put("date", sbn.postTime)
      ev.put("key", sbn.key)
      EventQueue.append(ctx, ev)
      AutoLogHeadlessService.trigger(ctx)
    } catch (_: Exception) {
    }
  }
}
