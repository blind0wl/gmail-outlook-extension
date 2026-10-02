// Offscreen chime player. Service workers cannot play audio, so this tiny
// document plays the bundled Checker Plus chime per "play-chime" runtime
// message. No network, no storage reads, no logging: the message carries only a volume level,
// never mail content.

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

if (globalThis.chrome && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener(function (message) {
    if (message && message.type === "play-chime") {
      playChime(levelOf(message));
    }
    return false;
  });
}
