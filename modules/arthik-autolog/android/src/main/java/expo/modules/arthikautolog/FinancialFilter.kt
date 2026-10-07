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

  // Email: login / security / password mails are never transaction inputs (spec email §6).
  // Only real OTP / security mails. Bank alerts often say "never share your OTP/password" in the
  // footer, so a bare mention of "OTP" or "password" must NOT drop the email.
  private val emailSecurity = Regex(
    "(?i)(is your (otp|one[ -]?time password|verification code)|(otp|one[ -]?time password|verification code) (is|for)\\b|reset your password|password (reset|changed|change request)|new (sign|log)[ -]?in|signed in (to|on|from)|security alert|2-step verification)"
  )

  /**
   * Email notification (Gmail, Outlook…) that is worth keeping: mentions money + a transaction word,
   * and is not a security / OTP mail. Personal and unrelated emails stop here and never reach JS.
   */
  fun isFinancialEmail(text: String?): Boolean {
    if (text.isNullOrBlank()) return false
    if (emailSecurity.containsMatchIn(text)) return false
    if (!money.containsMatchIn(text)) return false
    return txnWords.containsMatchIn(text)
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

  /** Email apps whose notifications may carry bank / payment alerts (only used when email detection is ON). */
  val EMAIL_APPS = mapOf(
    "com.google.android.gm" to "Gmail",
    "com.microsoft.office.outlook" to "Outlook",
    "com.samsung.android.email.provider" to "Samsung Email",
    "com.yahoo.mobile.client.android.mail" to "Yahoo Mail",
    "ch.protonmail.android" to "Proton Mail",
    "com.readdle.spark" to "Spark",
    "com.zoho.mail" to "Zoho Mail",
  )
}
