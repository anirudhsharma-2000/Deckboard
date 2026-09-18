package com.deckboard.app.widget

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

private const val CHANNEL_ID = "deckboard_widget_actions"
private const val NOTIFICATION_ID = 4201

private const val EXTRA_ACTION = "action"
private const val EXTRA_BUTTON_ID = "buttonId"
private const val EXTRA_BUTTON_LABEL = "buttonLabel"

private const val ACTION_PRESS = "press"
private const val ACTION_REFRESH = "refresh"

/**
 * Runs the widget's network round trip (connect, pair.resume, send, wait for
 * a result) as a brief foreground service instead of directly inside Glance's
 * ActionCallback, which is backed by a plain BroadcastReceiver with no
 * execution-priority guarantee. Without this, the OS can defer/throttle the
 * request under Doze or an App Standby bucket, and taps silently queue up
 * until the app happens to be opened in the foreground for an unrelated
 * reason — which is exactly the symptom this fixes. Starting a foreground
 * service from a widget-click callback is one of Android's documented
 * exemptions to the background-start restrictions. This is short-lived
 * enough (a LAN round trip, well under a second normally) that Android's
 * grace period before actually showing a foreground-service notification
 * usually means the user never sees it.
 */
class WidgetActionService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification())

        val action = intent?.getStringExtra(EXTRA_ACTION)
        scope.launch {
            try {
                when (action) {
                    ACTION_PRESS -> {
                        val buttonId = intent.getStringExtra(EXTRA_BUTTON_ID)
                        val label = intent.getStringExtra(EXTRA_BUTTON_LABEL) ?: ""
                        if (buttonId != null) {
                            WidgetActionSender.sendButtonPress(applicationContext, buttonId, label)
                        }
                    }
                    ACTION_REFRESH -> {
                        WidgetActionSender.refreshLayout(applicationContext)
                        WidgetUpdater.refreshAll(applicationContext)
                    }
                }
            } finally {
                stopSelf(startId)
            }
        }
        return START_NOT_STICKY
    }

    private fun buildNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                val channel = NotificationChannel(CHANNEL_ID, "Widget actions", NotificationManager.IMPORTANCE_MIN)
                channel.setShowBadge(false)
                manager.createNotificationChannel(channel)
            }
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("DeckBoard")
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setOngoing(true)
            .build()
    }

    companion object {
        fun press(context: Context, buttonId: String, label: String) {
            val intent = Intent(context, WidgetActionService::class.java)
                .putExtra(EXTRA_ACTION, ACTION_PRESS)
                .putExtra(EXTRA_BUTTON_ID, buttonId)
                .putExtra(EXTRA_BUTTON_LABEL, label)
            ContextCompat.startForegroundService(context, intent)
        }

        fun refresh(context: Context) {
            val intent = Intent(context, WidgetActionService::class.java)
                .putExtra(EXTRA_ACTION, ACTION_REFRESH)
            ContextCompat.startForegroundService(context, intent)
        }
    }
}
