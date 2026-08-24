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
// isiXhosa (xh-ZA) voice essentially nowhere. `pickVoice` therefore degrades
// deliberately rather than silently mispronouncing: it prefers an exact xh
// match, then any South African voice (en-ZA is far closer to isiXhosa vowel
// values than en-US), then whatever the browser considers default.

export function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function pickVoice(voices, lang) {
  if (!voices.length) return null;
  const want = lang === 'xh' ? 'xh' : 'en';
  return (
    voices.find((v) => v.lang?.toLowerCase().startsWith(want))
    ?? (want === 'xh' ? voices.find((v) => v.lang?.toLowerCase().endsWith('-za')) : null)
    ?? voices.find((v) => v.default)
    ?? voices[0]
  );
}

/**
 * @param {string} lang  current UI language ('en' | 'xh')
 * @returns {{
 *   supported: boolean, enabled: boolean, toggle: () => void, speak: (text: string) => void
 * }}
 */
export function useSpeech(lang) {
  const [enabled, setEnabled] = useState(false);
  const [voices, setVoices] = useState([]);
  const supported = speechSupported();
  // What was last spoken, so re-renders that don't change the narration text
  // don't restart the same sentence mid-word.
  const lastSpokenRef = useRef('');

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
    return () => window.speechSynthesis.cancel();
  }, [supported]);

  useEffect(() => {
    if (!supported || enabled) return;
    window.speechSynthesis.cancel();
    lastSpokenRef.current = '';
  }, [enabled, supported]);

  const speak = useCallback((text) => {
    if (!supported || !enabled) return;
    const clean = (text ?? '').trim();
    if (!clean || clean === lastSpokenRef.current) return;
    lastSpokenRef.current = clean;

    // Cancel first: queuing would make a fast-stepping visualizer read out a
    // growing backlog of stale steps long after the animation had moved on.
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    const voice = pickVoice(voices, lang);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? (lang === 'xh' ? 'xh-ZA' : 'en-ZA');
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }, [supported, enabled, voices, lang]);

  const toggle = useCallback(() => setEnabled((on) => !on), []);

  return { supported, enabled, toggle, speak };
}
