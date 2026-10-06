package expo.modules.arthikautolog

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject

class PaymentNotificationListener : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return
    val app = FinancialFilter.PAYMENT_APPS[sbn.packageName] ?: return // only payment apps
    val ctx = applicationContext ?: return
    if (!EventQueue.isCaptureEnabled(ctx)) return
    try {
      val extras = sbn.notification?.extras ?: return
      val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
      val text = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
        ?: extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
      val combined = "$title $text"
      if (!FinancialFilter.isPaymentNotification(combined)) return
      val ev = JSONObject()
      ev.put("type", "notification")
      ev.put("package", sbn.packageName)
      ev.put("app", app)
      ev.put("title", title)
      ev.put("body", text)
      ev.put("date", sbn.postTime)
      ev.put("key", sbn.key)
      EventQueue.append(ctx, ev)
      AutoLogHeadlessService.trigger(ctx)
    } catch (_: Exception) {
    }
  }
}
