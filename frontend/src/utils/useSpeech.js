import { useCallback, useEffect, useRef, useState } from 'react';

// Read-aloud narration, built on the browser's own SpeechSynthesis API so it
// needs no network, no API key and no extra dependency — the app stays usable
// offline, which is the whole point of shipping translations as static files.
//
// Cycle-1 usability feedback asked for this twice: once framed for audio
// learners, once explicitly for blind users. The visualizers already expose
// their narration to screen readers via aria-live; this is for students who
// are NOT running a screen reader but still want the steps spoken.
//
// Language note: browsers ship a good English voice almost everywhere, but an
// isiXhosa (xh-ZA) voice essentially nowhere. Falling back to en-ZA / the
// default voice would *sound* like it was working while mispronouncing the
// lesson, so isiXhosa does not speak. Clicking Read aloud opens a popup
// that says so, instead of silently doing nothing.

export function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// Join explanation fragments into one utterance. Empty bits are dropped so
// callers can pass optional "why" / error clauses without extra spaces.
export function joinSpeech(...parts) {
  return parts
    .flat()
    .filter((p) => typeof p === 'string' && p.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Speech engines read "→" as "right arrow" and "✓" as "check mark". Strip
// the decoration so the student hears the explanation, not the glyphs.
function forSpeech(text) {
  return text
    .replace(/[→←]/g, ', ')
    .replace(/[✓✗]/g, '')
    .replace(/…/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickVoice(voices) {
  if (!voices.length) return null;
  return (
    voices.find((v) => v.lang?.toLowerCase().startsWith('en'))
    ?? voices.find((v) => v.default)
    ?? voices[0]
  );
}

/**
 * @param {string} lang  current UI language ('en' | 'xh')
 * @returns {{
 *   supported: boolean, available: boolean, enabled: boolean,
 *   noticeOpen: boolean, dismissNotice: () => void,
 *   toggle: () => void,
 *   speak: (text: string, onEnded?: () => void) => void
 * }}
 */
export function useSpeech(lang) {
  const [enabled, setEnabled] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [voices, setVoices] = useState([]);
  const supported = speechSupported();
  // Browsers cannot speak isiXhosa. The button stays clickable so we can
  // show a popup instead of mispronouncing the translated narration.
  const available = supported && lang !== 'xh';
  // What was last spoken, so re-renders that don't change the narration text
  // don't restart the same sentence mid-word.
  const lastSpokenRef = useRef('');
  // Bumped on every new utterance / cancel so a cancelled utterance's
  // onend/onerror cannot be mistaken for "this sentence finished, advance".
  const utteranceIdRef = useRef(0);

  useEffect(() => {
    if (!supported) return undefined;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    // Chrome populates voices asynchronously and fires this once ready.
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, [supported]);

  // Never leave narration playing after the component goes away — without
  // this, navigating off mid-sentence keeps talking over the next screen.
  useEffect(() => {
    if (!supported) return undefined;
    return () => {
      utteranceIdRef.current += 1;
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  useEffect(() => {
    if (!supported || enabled) return;
    utteranceIdRef.current += 1;
    window.speechSynthesis.cancel();
    lastSpokenRef.current = '';
  }, [enabled, supported]);

  // Switching the UI to isiXhosa must stop any in-flight English utterance
  // and drop the toggle. Switching back to English closes the "not supported"
  // popup if it was still open.
  useEffect(() => {
    if (available) {
      setNoticeOpen(false);
      return;
    }
    setEnabled(false);
  }, [available]);

  const speak = useCallback((text, onEnded) => {
    if (!supported || !available || !enabled) return;
    const clean = forSpeech(text ?? '');
    if (!clean) {
      onEnded?.();
      return;
    }
    // Re-renders that don't change the line must not restart it mid-word.
    // When the caller is waiting to advance (onEnded), a repeat of the same
    // line still has to produce an end event or the animation stalls.
    if (!onEnded && clean === lastSpokenRef.current) return;

    const id = utteranceIdRef.current + 1;
    utteranceIdRef.current = id;
    lastSpokenRef.current = clean;

    // Cancel first: without this, a fast-stepping visualizer would queue a
    // backlog of stale steps. cancel() fires onend/onerror on the old
    // utterance — the generation id above is what stops that from looking
    // like the new sentence finished.
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    const voice = pickVoice(voices);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? 'en-ZA';
    utterance.rate = 0.95;

    let settled = false;
    let fallback = 0;
    let resumeWatch = 0;
    const finish = () => {
      if (settled || utteranceIdRef.current !== id) return;
      settled = true;
      window.clearTimeout(fallback);
      window.clearInterval(resumeWatch);
      onEnded?.();
    };
    utterance.onend = finish;
    // cancel() reports 'interrupted'/'canceled' on the *old* utterance; that
    // is not "this sentence finished". Ignoring it is what lets the current
    // line play to the end instead of jumping to the next step.
    utterance.onerror = (event) => {
      if (event.error === 'interrupted' || event.error === 'canceled') return;
      finish();
    };
    // Safety net only: onend is what actually advances. Sized well above a
    // slow reading of the line so a hang unsticks without clipping speech.
    const fallbackMs = Math.min(45000, Math.max(8000, clean.split(/\s+/).length * 800));
    fallback = window.setTimeout(finish, fallbackMs);

    // Chrome can drop the next speak() if it is issued in the same turn as
    // cancel(). A tick later is enough for the engine to accept it.
    window.setTimeout(() => {
      if (utteranceIdRef.current !== id) return;
      window.speechSynthesis.speak(utterance);
    }, 40);
    // Chrome pauses the engine after ~15s of continuous speech. Resume so a
    // long "why" is not truncated mid-sentence.
    resumeWatch = window.setInterval(() => {
      if (utteranceIdRef.current !== id) return;
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    }, 4000);
  }, [supported, available, enabled, voices]);

  const toggle = useCallback(() => {
    if (!available) {
      setNoticeOpen(true);
      return;
    }
    setEnabled((on) => !on);
  }, [available]);

  const dismissNotice = useCallback(() => setNoticeOpen(false), []);

  return {
    supported,
    available,
    enabled: available && enabled,
    noticeOpen,
    dismissNotice,
    toggle,
    speak,
  };
}
