package expo.modules.arthikautolog

import android.content.Context
import org.json.JSONObject
import java.io.File

/**
 * Tiny append-only JSON-lines queue in app-private storage.
 * Native receivers write here; JS drains it. Survives process death.
 */
object EventQueue {
  private const val FILE = "arthik_autolog_queue.jsonl"
  private const val PREFS = "arthik_autolog"
  private const val MAX_LINES = 2000
  private val lock = Any()

  private fun file(ctx: Context) = File(ctx.filesDir, FILE)

  fun isCaptureEnabled(ctx: Context): Boolean =
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("capture_enabled", false)

  fun setCaptureEnabled(ctx: Context, enabled: Boolean) {
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("capture_enabled", enabled).apply()
  }

  fun lastEventAt(ctx: Context): Long =
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong("last_event_at", 0L)

  fun append(ctx: Context, event: JSONObject) {
    synchronized(lock) {
      try {
        val f = file(ctx)
        if (f.exists() && f.length() > 2_000_000) {
          // Keep the newest lines only; never grow without bound.
          val lines = f.readLines().takeLast(MAX_LINES / 2)
          f.writeText(lines.joinToString("\n", postfix = "\n"))
        }
        f.appendText(event.toString() + "\n")
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
          .putLong("last_event_at", System.currentTimeMillis()).apply()
      } catch (_: Exception) {
      }
    }
  }

  fun drain(ctx: Context): List<String> {
    synchronized(lock) {
      return try {
        val f = file(ctx)
        if (!f.exists()) return emptyList()
        val lines = f.readLines().filter { it.isNotBlank() }
        f.writeText("")
        lines
      } catch (_: Exception) {
        emptyList()
      }
    }
  }

  fun size(ctx: Context): Int {
    synchronized(lock) {
      return try {
        val f = file(ctx)
        if (!f.exists()) 0 else f.readLines().count { it.isNotBlank() }
      } catch (_: Exception) {
        0
      }
    }
  }

  fun clear(ctx: Context) {
    synchronized(lock) {
      try { file(ctx).delete() } catch (_: Exception) {}
    }
  }
}
