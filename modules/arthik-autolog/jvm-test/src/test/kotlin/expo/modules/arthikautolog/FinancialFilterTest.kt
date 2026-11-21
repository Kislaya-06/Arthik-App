package expo.modules.arthikautolog

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** The native privacy gate: what may ever reach JS. */
class FinancialFilterTest {
  private val hdfc = "Sent Rs.349.00 From HDFC Bank A/C *1234 To ZOMATO On 05/10/26 Ref 628712345678"

  @Test fun keepsBankDebitSms() = assertTrue(FinancialFilter.isFinancialSms("VM-HDFCBK-S", hdfc))

  @Test fun keepsAmountWithoutCurrencyAfterVerb() =
    assertTrue(FinancialFilter.isFinancialSms("JD-SBIUPI-S", "Dear UPI user A/C X7821 debited by 500.0 on date 05Oct26 trf to RAHUL"))

  @Test fun keepsRupeeSymbolAndInr() {
    assertTrue(FinancialFilter.isFinancialSms("AX-ICICIT-S", "₹1,200 spent on ICICI Card XX9001 at AMAZON"))
    assertTrue(FinancialFilter.isFinancialSms("AX-AXISBK-S", "INR 250.00 credited to A/c no. XX1234 by UPI"))
  }

  @Test fun dropsSmsFromAPerson() {
    assertFalse(FinancialFilter.isFinancialSms("+919876543210", "Sent you Rs 500 for dinner via UPI"))
    assertFalse(FinancialFilter.isFinancialSms("9876543210", "Paid Rs 500 to you"))
    assertFalse(FinancialFilter.isFinancialSms("+91 98765 43210", "Rs 500 transferred to your account"))
  }

  @Test fun dropsOtps() {
    assertFalse(FinancialFilter.isFinancialSms("VM-HDFCBK", "123456 is your OTP for txn of Rs 500 at AMAZON"))
    assertFalse(FinancialFilter.isFinancialSms("VM-HDFCBK", "Your one-time password for a payment of Rs 500 is 4321"))
    assertFalse(FinancialFilter.isFinancialSms("VM-HDFCBK", "Verification code 4321 for UPI transaction of Rs 99"))
  }

  @Test fun dropsMessagesWithoutMoney() {
    assertFalse(FinancialFilter.isFinancialSms("VM-HDFCBK", "Your account statement for October is ready"))
    assertFalse(FinancialFilter.isFinancialSms("VM-HDFCBK", "Debit card blocked as requested. Call us for help"))
  }

  @Test fun dropsMoneyWithoutATransactionWord() =
    assertFalse(FinancialFilter.isFinancialSms("VM-SHOPPR", "Big sale! Everything at Rs 99 only today"))

  @Test fun dropsBlankInput() {
    assertFalse(FinancialFilter.isFinancialSms(null, hdfc))
    assertFalse(FinancialFilter.isFinancialSms("  ", hdfc))
    assertFalse(FinancialFilter.isFinancialSms("VM-HDFCBK", null))
    assertFalse(FinancialFilter.isFinancialSms("VM-HDFCBK", ""))
  }

  @Test fun keepsBankEmailEvenWithOtpAdviceFooter() = assertTrue(
    FinancialFilter.isFinancialEmail(
      "HDFC Bank Alerts Rs. 349.00 has been debited from your account XX1234 for UPI to ZOMATO. Never share your OTP or password."
    )
  )

  @Test fun dropsSecurityAndOtpEmails() {
    assertFalse(FinancialFilter.isFinancialEmail("123456 is your OTP for a transaction of Rs 500 on your card"))
    assertFalse(FinancialFilter.isFinancialEmail("Security alert: new sign-in to your account. Payment of Rs 0 pending"))
    assertFalse(FinancialFilter.isFinancialEmail("Reset your password. Your account has Rs 500 credit"))
  }

  @Test fun dropsNonFinancialEmails() {
    assertFalse(FinancialFilter.isFinancialEmail("Team lunch on Friday, see you there"))
    assertFalse(FinancialFilter.isFinancialEmail(null))
    assertFalse(FinancialFilter.isFinancialEmail(""))
  }

  @Test fun emailAppAllowList() {
    assertEquals("Gmail", FinancialFilter.EMAIL_APPS["com.google.android.gm"])
    assertEquals("Outlook", FinancialFilter.EMAIL_APPS["com.microsoft.office.outlook"])
    assertEquals(7, FinancialFilter.EMAIL_APPS.size)
    assertFalse(FinancialFilter.EMAIL_APPS.containsKey("com.phonepe.app"))
    assertFalse(FinancialFilter.EMAIL_APPS.containsKey("com.google.android.apps.nbu.paisa.user"))
  }
}
