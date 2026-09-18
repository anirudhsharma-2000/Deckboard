package com.deckboard.app.ui.grid

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.deckboard.app.data.protocol.BackgroundConfig
import com.deckboard.app.data.protocol.BackgroundPresets
import com.deckboard.app.data.protocol.ButtonConfig
import com.deckboard.app.data.socket.DeckSocketClient
import com.deckboard.app.ui.components.ConnectionStatusBar
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ButtonGridScreen(viewModel: ButtonGridViewModel, onDisconnected: () -> Unit) {
    val connectionState by viewModel.connectionState.collectAsState()
    val layout by viewModel.layoutState.collectAsState()
    val target by viewModel.activeTarget.collectAsState()
    val background by viewModel.backgroundState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    var showMenu by remember { mutableStateOf(false) }
    var showDisconnectConfirm by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.feedback.collect { feedback ->
            if (!feedback.success) {
                scope.launch { snackbarHostState.showSnackbar(feedback.message ?: "Action failed") }
            }
        }
    }

    if (showDisconnectConfirm) {
        AlertDialog(
            onDismissRequest = { showDisconnectConfirm = false },
            title = { Text("Disconnect?") },
            text = { Text("You'll need to pair again to reconnect, to this server or a different one.") },
            confirmButton = {
                TextButton(onClick = {
                    showDisconnectConfirm = false
                    viewModel.disconnect(onDone = onDisconnected)
                }) { Text("Disconnect") }
            },
            dismissButton = {
                TextButton(onClick = { showDisconnectConfirm = false }) { Text("Cancel") }
            },
        )
    }

    val hasCustomBackground = background != null && background !is BackgroundConfig.None

    Box(modifier = Modifier.fillMaxSize()) {
        BackgroundLayer(background = background, target = target)

        Scaffold(
            containerColor = if (hasCustomBackground) Color.Transparent else MaterialTheme.colorScheme.background,
            snackbarHost = { SnackbarHost(snackbarHostState) },
            topBar = {
                TopAppBar(
                    title = { Text("DeckBoard") },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent),
                    actions = {
                        IconButton(onClick = { showMenu = true }) {
                            Icon(Icons.Default.MoreVert, contentDescription = "More options")
                        }
                        DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
                            DropdownMenuItem(
                                text = { Text("Disconnect") },
                                onClick = {
                                    showMenu = false
                                    showDisconnectConfirm = true
                                },
                            )
                        }
                    },
                )
            },
        ) { padding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
            ) {
                ConnectionStatusBar(state = connectionState)

                val pages = layout?.pages.orEmpty()
                if (pages.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Outlined.GridView,
                                contentDescription = null,
                                modifier = Modifier.size(40.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = "Waiting for layout…",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Add buttons from the dashboard on your computer",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                } else {
                    val pagerState = rememberPagerState(pageCount = { pages.size })

                    LaunchedEffect(layout?.activePageId, pages) {
                        val targetIndex = pages.indexOfFirst { it.id == layout?.activePageId }
                        if (targetIndex >= 0 && targetIndex != pagerState.currentPage) {
                            pagerState.animateScrollToPage(targetIndex)
                        }
                    }

                    if (pages.size > 1) {
                        // TabRow's default containerColor is opaque
                        // (colorScheme.surface) — without overriding it, the
                        // tab strip paints a solid block over whatever custom
                        // background/preset is active instead of blending
                        // with it.
                        TabRow(
                            selectedTabIndex = pagerState.currentPage,
                            containerColor = if (hasCustomBackground) Color.Transparent else MaterialTheme.colorScheme.surface,
                        ) {
                            pages.forEachIndexed { index, page ->
                                Tab(
                                    selected = pagerState.currentPage == index,
                                    onClick = { scope.launch { pagerState.animateScrollToPage(index) } },
                                    text = { Text(page.name) },
                                )
                            }
                        }
                    }

                    HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { pageIndex ->
                        val page = pages[pageIndex]
                        LazyVerticalGrid(
                            columns = GridCells.Fixed(page.columns.coerceAtLeast(1)),
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                        ) {
                            items(page.buttons, key = { it.id }) { button ->
                                DeckButton(
                                    button = button,
                                    imageUrl = iconImageUrl(button.icon, target),
                                    onClick = { viewModel.onButtonPressed(button.id, button.label) },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun BackgroundLayer(background: BackgroundConfig?, target: DeckSocketClient.PairingTarget?) {
    when (background) {
        is BackgroundConfig.Preset -> {
            val preset = BackgroundPresets.find(background.presetId) ?: return
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Brush.linearGradient(listOf(Color(preset.colors.first), Color(preset.colors.second)))),
            )
        }
        is BackgroundConfig.Custom -> {
            if (target != null) {
                AsyncImage(
                    model = "http://${target.host}:${target.port}${background.url}",
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                )
            }
        }
        else -> {}
    }
}

private fun iconImageUrl(icon: String, target: DeckSocketClient.PairingTarget?): String? {
    if (target == null || !icon.startsWith("/api/icons/")) return null
    return "http://${target.host}:${target.port}$icon"
}

@Composable
private fun DeckButton(button: ButtonConfig, imageUrl: String?, onClick: () -> Unit) {
    val haptics = LocalHapticFeedback.current
    val interactionSource = remember { MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(targetValue = if (pressed) 0.94f else 1f, label = "buttonScale")
    val elevation by animateDpAsState(targetValue = if (pressed) 1.dp else 3.dp, label = "buttonElevation")
    val shape = RoundedCornerShape(20.dp)

    Box(
        modifier = Modifier
            .padding(6.dp)
            .aspectRatio(1f)
            .scale(scale)
            .shadow(elevation, shape, clip = false)
            .clip(shape)
            .background(
                Brush.verticalGradient(
                    listOf(
                        MaterialTheme.colorScheme.surfaceVariant,
                        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.72f),
                    ),
                ),
            )
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.15f), shape)
            .clickable(interactionSource = interactionSource, indication = null) {
                haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                onClick()
            },
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            when {
                imageUrl != null -> AsyncImage(
                    model = imageUrl,
                    contentDescription = null,
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(10.dp)),
                    contentScale = ContentScale.Fit,
                )
                button.icon.isNotEmpty() -> Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.55f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(text = button.icon, style = MaterialTheme.typography.headlineMedium)
                }
            }
            if (button.label.isNotEmpty()) {
                if (imageUrl != null || button.icon.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(6.dp))
                }
                Text(
                    text = button.label,
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
            }
        }
    }
}
