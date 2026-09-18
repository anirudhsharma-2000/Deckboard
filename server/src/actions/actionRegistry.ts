import { execFile } from "node:child_process";
import { promisify } from "node:util";
import open from "open";
import type { ActionConfig, SystemCommand } from "@deckboard/shared";
import { logger } from "../logger.js";
import { switchObsScene } from "./obsClient.js";

const execFileAsync = promisify(execFile);

export interface ActionOutcome {
  success: boolean;
  message?: string;
}

export async function executeAction(action: ActionConfig): Promise<ActionOutcome> {
  switch (action.type) {
    case "none":
      return { success: true };
    case "open_url":
      return runOpenUrl(action.url);
    case "hotkey":
      return runHotkey(action.keys);
    case "obs_scene":
      return runObsScene(action.sceneName);
    case "launch_app":
      return runLaunchApp(action.appPath, action.appName);
    case "system":
      return runSystemAction(action.command);
  }
}

async function runOpenUrl(url: string): Promise<ActionOutcome> {
  try {
    await open(url);
    return { success: true };
  } catch (err) {
    logger.error("open_url action failed", err);
    return { success: false, message: "Failed to open URL" };
  }
}

const MODIFIER_KEYWORDS: Record<string, string> = {
  cmd: "command down",
  command: "command down",
  ctrl: "control down",
  control: "control down",
  alt: "option down",
  option: "option down",
  shift: "shift down",
};

// AppleScript's `keystroke "text"` types literal characters — it has no
// concept of a function/navigation key, so `keystroke "F7"` types the two
// characters "F" and "7" rather than pressing the F7 key. Named keys need
// `key code <N>` instead (US ANSI virtual keycodes) to actually press the
// physical key they're named after.
const SPECIAL_KEY_CODES: Record<string, number> = {
  f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97, f7: 98, f8: 100,
  f9: 101, f10: 109, f11: 103, f12: 111, f13: 105, f14: 107, f15: 113,
  f16: 106, f17: 64, f18: 79, f19: 80, f20: 90,
  escape: 53, esc: 53,
  return: 36, enter: 36,
  tab: 48,
  space: 49, spacebar: 49,
  delete: 51, backspace: 51,
  forwarddelete: 117,
  left: 123, right: 124, down: 125, up: 126,
  home: 115, end: 119,
  pageup: 116, pagedown: 121,
};

function buildKeystrokeScript(keys: string[]): string {
  const modifiers = keys
    .slice(0, -1)
    .map((k) => MODIFIER_KEYWORDS[k.toLowerCase()])
    .filter((m): m is string => Boolean(m));
  const using = modifiers.length > 0 ? ` using {${modifiers.join(", ")}}` : "";

  const rawKey = keys[keys.length - 1] ?? "";
  const specialCode = SPECIAL_KEY_CODES[rawKey.toLowerCase().replace(/\s+/g, "")];
  if (specialCode !== undefined) {
    return `tell application "System Events" to key code ${specialCode}${using}`;
  }

  const key = rawKey.replace(/"/g, '\\"');
  return `tell application "System Events" to keystroke "${key}"${using}`;
}

async function runHotkey(keys: string[]): Promise<ActionOutcome> {
  if (process.platform !== "darwin") {
    logger.warn(`hotkey action requested but unsupported on platform "${process.platform}"`);
    return { success: false, message: "Hotkeys are only supported on macOS right now" };
  }
  if (keys.length === 0) {
    return { success: false, message: "No keys configured" };
  }

  try {
    // execFile (not exec) so the script never passes through a shell — no
    // injection risk from whatever the button's key combo string contains.
    await execFileAsync("osascript", ["-e", buildKeystrokeScript(keys)]);
    return { success: true };
  } catch (err) {
    logger.error("hotkey action failed", err);
    return { success: false, message: "Failed to send hotkey — check Accessibility permissions" };
  }
}

async function runObsScene(sceneName: string): Promise<ActionOutcome> {
  try {
    await switchObsScene(sceneName);
    return { success: true };
  } catch (err) {
    logger.error("obs_scene action failed", err);
    return { success: false, message: err instanceof Error ? err.message : "OBS action failed" };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// `open()` hands off the launch and returns as soon as the app process is
// spawned — it doesn't wait for (or guarantee) the app actually taking
// keyboard focus once it's finished booting, which loses the race for
// slow-starting apps (JVM-based IDEs, etc). Kicked off without awaiting so
// action.result still returns immediately; the retries run in the
// background giving the app a few seconds to register as a process before
// we try to activate it.
async function activateAppSoon(appName: string): Promise<void> {
  if (process.platform !== "darwin") return;
  const script = `tell application "System Events" to set frontmost of first process whose name is "${appName.replace(/"/g, '\\"')}" to true`;
  for (let attempt = 0; attempt < 6; attempt++) {
    await delay(400);
    try {
      await execFileAsync("osascript", ["-e", script]);
      return;
    } catch {
      // process not registered yet — retry
    }
  }
}

async function runLaunchApp(appPath: string, appName: string): Promise<ActionOutcome> {
  try {
    await open(appPath);
    void activateAppSoon(appName);
    return { success: true };
  } catch (err) {
    logger.error("launch_app action failed", err);
    return { success: false, message: "Failed to launch app" };
  }
}

type AppleScriptCommand = Exclude<SystemCommand, "media_play_pause" | "media_next" | "media_previous">;

// key code 20/21/23 = the '3'/'4'/'5' row keys — simulating the literal OS
// shortcut (rather than shelling out to `screencapture` with hand-picked
// flags) means these respect whatever the user has configured in the
// Screenshot app (save location, clipboard-only, etc).
function systemActionScript(command: AppleScriptCommand): string {
  switch (command) {
    case "lock":
      return 'tell application "System Events" to keystroke "q" using {control down, command down}';
    case "sleep":
      return 'tell application "System Events" to sleep';
    case "mute":
      return "set volume output muted true";
    case "volume_up":
      return "set volume output volume ((output volume of (get volume settings)) + 10)";
    case "volume_down":
      return "set volume output volume ((output volume of (get volume settings)) - 10)";
    case "screenshot_full":
      return 'tell application "System Events" to key code 20 using {command down, shift down}';
    case "screenshot_selection":
      return 'tell application "System Events" to key code 21 using {command down, shift down}';
    case "screenshot_recording":
      return 'tell application "System Events" to key code 23 using {command down, shift down}';
    case "empty_trash":
      return 'tell application "Finder" to empty trash';
    case "log_out":
      return 'tell application "System Events" to log out';
    case "restart":
      return 'tell application "System Events" to restart';
    case "shut_down":
      return 'tell application "System Events" to shut down';
  }
}

// NX_KEYTYPE_* constants from IOKit/hidsystem/ev_keymap.h — the same codes a
// physical Mac keyboard's media keys send. Posted as real system-wide HID
// events via CGEventPost, so this works no matter which app is "now playing"
// (Music, Spotify, a browser tab, ...), unlike scripting one app by name.
const MEDIA_KEY_CODES: Record<"media_play_pause" | "media_next" | "media_previous", number> = {
  media_play_pause: 16,
  media_next: 17,
  media_previous: 18,
};

function mediaKeyScript(keyCode: number): string {
  // The down/up state must be encoded in BOTH the outer `modifierFlags` slot
  // (0xa00 down / 0xb00 up) AND the embedded data1 byte — leaving
  // modifierFlags fixed at 0xa00 for both posts sends an inconsistent
  // down/up pair that the system media-remote dispatch silently ignores.
  return `
ObjC.import('Cocoa');
ObjC.import('CoreGraphics');
function post(down) {
  var flags = down ? 0xa00 : 0xb00;
  var data1 = (${keyCode} << 16) | ((down ? 0xa : 0xb) << 8);
  var ev = $.NSEvent.otherEventWithTypeLocationModifierFlagsTimestampWindowNumberContextSubtypeData1Data2(
    14, $.NSMakePoint(0, 0), flags, 0, 0, $(), 8, data1, -1
  );
  $.CGEventPost($.kCGSessionEventTap, ev.CGEvent);
}
post(true);
post(false);
`;
}

// Browsers frequently don't register their <video>/<audio> elements with
// macOS's system-wide "Now Playing"/MediaRemote dispatch, so the HID media
// key below is silently dropped (or, on some macOS versions, the synthetic
// NX_KEYTYPE_PLAY event isn't delivered at all — CGEventPost reports success
// without actually reaching any app) when a browser tab is what's actually
// playing.
//
// This scans every recognized, currently-running browser's tabs — not just
// whichever app happens to be frontmost — because a Stream-Deck-style button
// is routinely pressed while a completely different app has focus (that's
// the whole point of a hardware deck). Gating on "browser is frontmost"
// would miss that common case entirely.
type BrowserFamily = "chromium" | "safari";

const BROWSERS: { appName: string; family: BrowserFamily }[] = [
  { appName: "Safari", family: "safari" },
  { appName: "Google Chrome", family: "chromium" },
  { appName: "Google Chrome Canary", family: "chromium" },
  { appName: "Microsoft Edge", family: "chromium" },
  { appName: "Brave Browser", family: "chromium" },
  { appName: "Arc", family: "chromium" },
  { appName: "Vivaldi", family: "chromium" },
  { appName: "Opera", family: "chromium" },
  { appName: "Chromium", family: "chromium" },
];

const TOGGLE_MEDIA_JS = `(function(){
  var els = document.querySelectorAll('video, audio');
  for (var i = 0; i < els.length; i++) if (!els[i].paused) { els[i].pause(); return 'paused'; }
  for (var i = 0; i < els.length; i++) if (els[i].paused) { els[i].play(); return 'played'; }
  return 'none';
})()`;

const BROWSER_SCAN_TIMEOUT_MS = 1500;

// A "System Events exists process" check on its own, deliberately kept
// separate from the app-specific script below: `tell application "X"` where
// X isn't installed fails to *compile* (AppleScript can't resolve X's
// command dictionary to parse "execute ... javascript ...", a Chrome/Safari-
// specific verb, not a generic one) — a clean try/catch around a combined
// script doesn't help, since the whole thing fails before it ever runs. So
// we only attempt the app-specific script once we've confirmed the process
// is actually running (which guarantees it's installed).
async function isAppRunning(appName: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      "osascript",
      ["-e", `tell application "System Events" to (exists process "${appName.replace(/"/g, '\\"')}")`],
      // SIGKILL, not the default SIGTERM — a hung osascript blocked in an
      // Apple Event round trip doesn't reliably respond to SIGTERM (verified
      // live: it stayed alive well past the timeout), so a soft kill signal
      // isn't enough to guarantee the deadline is actually honored.
      { timeout: 2000, killSignal: "SIGKILL" },
    );
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

function browserToggleScript(appName: string, family: BrowserFamily): string {
  const escapedJs = TOGGLE_MEDIA_JS.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const escapedAppName = appName.replace(/"/g, '\\"');
  // Only the *active* tab of each window, not every tab — looping every tab
  // doesn't scale (a window can easily have 100+ tabs) and the active tab is
  // overwhelmingly where playback actually is. Safari calls it "current tab";
  // Chromium-family browsers call it "active tab".
  const getTab = family === "safari" ? "current tab of w" : "active tab of w";
  const toggleCall = family === "safari" ? `do JavaScript "${escapedJs}" in t` : `execute t javascript "${escapedJs}"`;
  return `
tell application "${escapedAppName}"
  repeat with w in windows
    try
      set t to ${getTab}
      set r to (${toggleCall})
      if r is not "none" then return "toggled"
    end try
  end repeat
end tell
return "none"
`;
}

/** Returns true if some running browser's tab was found playing and toggled. */
async function toggleAnyBrowserMedia(): Promise<boolean> {
  // Check every candidate's "is it running" status concurrently — sequential
  // checks meant paying ~1.6s (System Events overhead for a non-running
  // process) per candidate, which adds up to 10+ seconds across the full
  // browser list even though almost none of them are actually running.
  const runningFlags = await Promise.all(BROWSERS.map((b) => isAppRunning(b.appName)));
  const runningBrowsers = BROWSERS.filter((_, i) => runningFlags[i]);

  for (const { appName, family } of runningBrowsers) {
    try {
      // Hard timeout (SIGKILL — see isAppRunning) so one slow/stuck tab (an
      // open alert(), a hung page, dozens of tabs) can't block the whole
      // button press indefinitely.
      const { stdout } = await execFileAsync("osascript", ["-e", browserToggleScript(appName, family)], {
        timeout: BROWSER_SCAN_TIMEOUT_MS,
        killSignal: "SIGKILL",
      });
      if (stdout.trim() === "toggled") return true;
    } catch (err) {
      // Running but not scriptable right now (most likely "Allow JavaScript
      // from Apple Events" is disabled for it, or it timed out) — move on to
      // the next candidate rather than failing the whole action.
      logger.warn(`browser media toggle failed for "${appName}"`, err);
    }
  }
  return false;
}

// Native, first-party AppleScript dictionaries for the two most common
// desktop media apps. Far more reliable than the CGEventPost HID-key
// simulation below — that technique posts the same synthetic event a
// physical media key sends, and on current macOS that synthetic event can
// silently go nowhere (verified: firing it against Music.app mid-playback
// left the player state completely unchanged, no error, no effect) —
// apparently blocked at the OS level for security reasons on newer macOS
// versions. Talking to the app directly via its own scripting dictionary
// sidesteps that entirely.
const NATIVE_MEDIA_APPS = ["Spotify", "Music"];

async function queryPlayerState(appName: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("osascript", ["-e", `tell application "${appName}" to player state`], {
      timeout: 2000,
      killSignal: "SIGKILL",
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

/** Returns true if a running native media app handled the command. */
async function tryNativeMediaApp(command: "media_play_pause" | "media_next" | "media_previous"): Promise<boolean> {
  const runningFlags = await Promise.all(NATIVE_MEDIA_APPS.map((a) => isAppRunning(a)));
  const runningApps = NATIVE_MEDIA_APPS.filter((_, i) => runningFlags[i]);

  for (const appName of runningApps) {
    // Query state first rather than calling "playpause" directly — verified
    // live that "playpause" (and even a bare "play") can hang indefinitely
    // when nothing is currently loaded ("stopped" with no cued track),
    // apparently while the app tries to resolve what to start playing.
    // Querying state and branching to the specific "pause"/"play" verb for
    // an already-loaded track avoids that hang entirely; "stopped" (nothing
    // loaded at all) is treated as nothing to control here, same as a real
    // media key would do on a genuinely idle player — and we skip straight
    // to the next candidate instead of risking the same hang.
    const state = await queryPlayerState(appName);
    if (state === null || state === "stopped") continue;

    const verb =
      command === "media_next" ? "next track" : command === "media_previous" ? "previous track" : state === "playing" ? "pause" : "play";

    try {
      await execFileAsync("osascript", ["-e", `tell application "${appName}" to ${verb}`], {
        timeout: 2000,
        killSignal: "SIGKILL",
      });
      return true;
    } catch (err) {
      logger.warn(`native media control failed for "${appName}"`, err);
    }
  }
  return false;
}

// restart/shut_down/log_out/empty_trash are disruptive by design — same as a
// real Stream Deck's built-in System actions — there is intentionally no
// confirmation step here; the button itself is the confirmation.
async function runSystemAction(command: SystemCommand): Promise<ActionOutcome> {
  if (process.platform !== "darwin") {
    logger.warn(`system action "${command}" requested but unsupported on platform "${process.platform}"`);
    return { success: false, message: "System actions are only supported on macOS right now" };
  }

  try {
    if (command === "media_play_pause") {
      if (await toggleAnyBrowserMedia()) return { success: true };
      if (await tryNativeMediaApp(command)) return { success: true };
      await execFileAsync("osascript", ["-l", "JavaScript", "-e", mediaKeyScript(MEDIA_KEY_CODES[command])]);
      return { success: true };
    }

    if (command === "media_next" || command === "media_previous") {
      if (await tryNativeMediaApp(command)) return { success: true };
      await execFileAsync("osascript", ["-l", "JavaScript", "-e", mediaKeyScript(MEDIA_KEY_CODES[command])]);
      return { success: true };
    }

    await execFileAsync("osascript", ["-e", systemActionScript(command)]);
    return { success: true };
  } catch (err) {
    logger.error(`system action "${command}" failed`, err);
    return { success: false, message: "System action failed" };
  }
}
