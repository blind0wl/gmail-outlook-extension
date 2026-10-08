// Shared offscreen page for chimes and explicit clipboard writes. It never
// reads the clipboard, stores codes, or logs message content.

var PLAY_CHIME_MESSAGE = "play-chime";
var COPY_AUTH_CODE_MESSAGE = "copy-auth-code-to-clipboard";

var audio = null;

function levelOf(message) {
  var level = message && message.volume;
  if (typeof level !== "number" || Number.isNaN(level)) return 0.5;
  return Math.min(1, Math.max(0, level));
}

function playChime(level) {
  try {
    if (!audio) {
      audio = new Audio(chrome.runtime.getURL("src/notify/sounds/chime.mp3"));
    }
    audio.volume = level;
    audio.currentTime = 0;
    void audio.play().catch(function () {
      // Missing media or blocked playback must not cause an unhandled rejection.
    });
  } catch {
    // Audio must never break anything: swallow silently, no logging.
  }
}

function copyCode(code) {
  if (typeof code !== "string" || !/^[a-z0-9]{4,10}$/i.test(code)) return false;
  var field = document.createElement("textarea");
  field.value = code;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.top = "0";
  field.style.left = "0";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.focus();
  field.select();
  var copied = false;
  try { copied = document.execCommand("copy") === true; }
  catch { copied = false; }
  field.remove();
  return copied;
}

if (globalThis.chrome && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (message && message.type === PLAY_CHIME_MESSAGE) {
      playChime(levelOf(message));
      return false;
    }
    if (message && message.type === COPY_AUTH_CODE_MESSAGE) {
      sendResponse({ ok: copyCode(message.code) });
      return false;
    }
    return false;
  });
}
