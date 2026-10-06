package expo.modules.arthikautolog

/**
 * First privacy gate. Runs natively BEFORE anything reaches JS.
 * Personal SMS (from phone numbers), OTPs and messages without any money mention
 * are dropped here and never stored or processed.
 */
object FinancialFilter {
  private val phoneSender = Regex("^\\+?[0-9 ]{8,15}$")
  private val money = Regex("(?i)((rs\\.?|inr|₹)\\s*[0-9]|(debited|credited)\\s+(by|for|with|of)?\\s*[0-9])")
  private val otp = Regex("(?i)\\b(otp|one[ -]?time[ -]?password|verification code|auth(entication)? code)\\b")
  private val txnWords = Regex(
    "(?i)(debit|credit|spent|paid|received|sent|withdraw|txn|transaction|purchase|refund|transfer|deposit|upi|a/c|acct|account|card|reversal|neft|imps|rtgs)"
  )

  /** True when an SMS is worth keeping as a bank-transaction candidate. */
  fun isFinancialSms(sender: String?, body: String?): Boolean {
    if (sender.isNullOrBlank() || body.isNullOrBlank()) return false
    val s = sender.trim()
    if (phoneSender.matches(s)) return false // personal message from a person
    if (otp.containsMatchIn(body)) return false
    if (!money.containsMatchIn(body)) return false
    return txnWords.containsMatchIn(body)
  }

  /** Notifications from allow-listed payment apps that mention money. */
  fun isPaymentNotification(text: String?): Boolean {
    if (text.isNullOrBlank()) return false
    if (otp.containsMatchIn(text)) return false
    return money.containsMatchIn(text)
  }

  val PAYMENT_APPS = mapOf(
    "com.google.android.apps.nbu.paisa.user" to "Google Pay",
    "com.phonepe.app" to "PhonePe",
    "net.one97.paytm" to "Paytm",
    "com.naviapp" to "Navi",
    "in.org.npci.upiapp" to "BHIM",
    "com.dreamplug.androidapp" to "CRED",
    "in.amazon.mShop.android.shopping" to "Amazon Pay",
    "com.mobikwik_new" to "MobiKwik",
    "money.super.payments" to "super.money",
  )
}
