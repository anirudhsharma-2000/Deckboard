package com.deckboard.app.widget

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback

val BUTTON_ID_KEY = ActionParameters.Key<String>("buttonId")
val BUTTON_LABEL_KEY = ActionParameters.Key<String>("buttonLabel")

class PressButtonAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val buttonId = parameters[BUTTON_ID_KEY] ?: return
        val label = parameters[BUTTON_LABEL_KEY] ?: ""
        // Hand off to a foreground service rather than doing the network round
        // trip here — see WidgetActionService for why.
        WidgetActionService.press(context, buttonId, label)
    }
}
