// Offscreen chime player. Service workers cannot play audio, so this tiny
// document owns the extension's only AudioContext and plays one short
// synthesized chime per "play-chime" runtime message. No network, no
// storage reads, no logging: the message carries only a volume level,
// never mail content.

var context = null;

function levelOf(message) {
  var level = message && message.volume;
  if (typeof level !== "number" || Number.isNaN(level)) return 0.5;
  return Math.min(1, Math.max(0, level));
}

// Two-note chime (E6 then B6), ~0.3s total, gain envelope so there is no
// click on start or stop.
function playChime(level) {
  try {
    var AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    if (!context) context = new AC();
    if (context.state === "suspended") void context.resume();
    var now = context.currentTime;
    var gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, level), now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    gain.connect(context.destination);
    var notes = [
      { freq: 659.25, at: 0 },
      { freq: 987.77, at: 0.14 },
    ];
    for (var i = 0; i < notes.length; i++) {
      var osc = context.createOscillator();
      osc.type = "sine";
      osc.frequency.value = notes[i].freq;
      osc.connect(gain);
      osc.start(now + notes[i].at);
      osc.stop(now + 0.34);
    }
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
