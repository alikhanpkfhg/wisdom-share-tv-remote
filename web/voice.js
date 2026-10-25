// Voice control (phase 2, experimental).
//
// Privacy: uses the browser's speech recognition. On Safari much of it runs
// on-device; on Chrome/Edge the audio is processed by Google's service — the
// mic indicator in the browser makes this visible. No audio is ever sent to
// the TV or the bridge.
//
// Safety: recognized speech is mapped onto a FIXED grammar that only produces
// validated bridge calls (same whitelist as the buttons). Unknown utterances
// are rejected. Disruptive actions (power off, app launch) require an explicit
// confirmation tap. The basic remote works exactly the same with voice absent.

function setupVoice({ sendKey, api, toast, confirmFn }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return false;
  const btn = document.getElementById('voiceBtn');
  if (!btn) return false;
  btn.classList.remove('hidden');

  const APP_ALIASES = {
    youtube: 'com.google.android.youtube.youtube',
    netflix: 'com.netflix.mediaclient',
    spotify: 'com.spotify.music',
  };

  const rules = [
    { re: /(volume|sound).*(up|louder)|turn (it )?up/i, say: 'Volume up', act: () => sendKey(24) },
    { re: /(volume|sound).*(down|quieter|lower)|turn (it )?down/i, say: 'Volume down', act: () => sendKey(25) },
    { re: /\b(mute|silence)\b/i, say: 'Mute (experimental)', act: () => sendKey(164) },
    { re: /\b(press |select )?(ok|enter|select)\b/i, say: 'OK', act: () => sendKey(23) },
    { re: /\b(go )?back\b/i, say: 'Back', act: () => sendKey(4) },
    { re: /\bhome\b|main screen/i, say: 'Home', act: () => sendKey(3) },
    { re: /\bmenu\b/i, say: 'Menu', act: () => sendKey(82) },
    {
      re: /\b(power off|turn off|shut ?down|standby)\b/i,
      say: 'Power off',
      act: () => {
        if (confirmFn('Turn the TV off?')) return sendKey(26);
      },
    },
    {
      re: /\bopen ([a-z0-9 .]+)\b/i,
      say: 'Open app',
      act: (m) => {
        const raw = m[1].trim().replace(/\s+$/, '');
        const pkg = APP_ALIASES[raw.toLowerCase()] || (raw.includes('.') ? raw : null);
        if (!pkg) {
          toast('Say the full package name, e.g. "open com.google.android.youtube"', true);
          return;
        }
        if (!confirmFn(`Open ${pkg} on the TV?`)) return;
        return api('/api/app/open', { package: pkg }).then((r) => {
          if (!r.ok) toast('TV answered: ' + (r.body || r.status), true);
        });
      },
    },
  ];

  let rec;
  try {
    rec = new SR();
  } catch {
    return false;
  }
  rec.lang = navigator.language || 'en-US';
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  rec.onresult = async (ev) => {
    const text = ev.results[0][0].transcript;
    for (const r of rules) {
      const m = text.match(r.re);
      if (m) {
        try {
          await r.act(m);
          toast('Voice: ' + r.say);
        } catch (e) {
          toast(e.message, true);
        }
        return;
      }
    }
    toast('Voice not understood: "' + text + '"', true);
  };
  rec.onerror = (ev) => toast('Voice error: ' + ev.error, true);

  btn.onclick = () => {
    try {
      rec.start();
      toast('Listening…');
    } catch {
      toast('Microphone busy', true);
    }
  };
  return true;
}