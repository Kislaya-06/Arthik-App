package expo.modules.arthikautolog

import android.content.Context
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/** Wakes JS for a few seconds to process queued events while the app is closed. */
class AutoLogHeadlessService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig {
    return HeadlessJsTaskConfig("ArthikAutoLogTask", Arguments.createMap(), 60_000, true)
  }

  companion object {
    @Volatile private var lastStart = 0L

    fun trigger(ctx: Context) {
      val now = System.currentTimeMillis()
      if (now - lastStart < 3_000) return // debounce bursts (multi-part SMS etc.)
      lastStart = now
      try {
        ctx.startService(Intent(ctx, AutoLogHeadlessService::class.java))
        HeadlessJsTaskService.acquireWakeLockNow(ctx)
      } catch (_: Exception) {
        // Background-start restrictions: queue stays on disk and is processed on next
        // app open or by the periodic background task. Nothing is lost.
      }
    }
  }
}
