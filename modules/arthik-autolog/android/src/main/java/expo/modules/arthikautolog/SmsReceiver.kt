package expo.modules.arthikautolog

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import org.json.JSONObject

class SmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
    if (!EventQueue.isCaptureEnabled(context)) return // signed out / paused → nothing captured
    try {
      val parts = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
      // Multi-part SMS arrive as several PDUs: join them per sender.
      val grouped = LinkedHashMap<String, Pair<StringBuilder, Long>>()
      for (m in parts) {
        val from = m.originatingAddress ?: continue
        val entry = grouped.getOrPut(from) { Pair(StringBuilder(), m.timestampMillis) }
        entry.first.append(m.messageBody ?: "")
      }
      var queued = false
      for ((from, pair) in grouped) {
        val body = pair.first.toString()
        if (!FinancialFilter.isFinancialSms(from, body)) continue
        val ev = JSONObject()
        ev.put("type", "sms")
        ev.put("address", from)
        ev.put("body", body)
        ev.put("date", pair.second)
        ev.put("receivedAt", System.currentTimeMillis())
        EventQueue.append(context, ev)
        queued = true
      }
      if (queued) AutoLogHeadlessService.trigger(context)
    } catch (_: Exception) {
    }
  }
}
