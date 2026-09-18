package com.deckboard.app.widget

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback

class RefreshLayoutAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        // Hand off to a foreground service rather than doing the network round
        // trip here — see WidgetActionService for why.
        WidgetActionService.refresh(context)
    }
}
