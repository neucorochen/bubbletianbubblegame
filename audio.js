const SoundFX = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    }
    if (ctx && ctx.state === "suspended") {
      ctx.resume();
    }
    return ctx;
  }

  // Мягкий выстрел-бульк
  function playShoot() {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.09);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // Желейный отскок от стены
  function playBounce() {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.1);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // Мягкое влажное «хлюп» при прилипании
  function playSquelch() {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    const filter = c.createBiquadFilter();
    const gain = c.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(290, now);
    osc.frequency.exponentialRampToValueAtTime(125, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(175, now + 0.13);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(650, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Воздушное лопанье пузырька (с нарастающим тоном для комбо)
  function playPop(step = 0) {
    const c = getCtx();
    if (!c) return;
    const start = c.currentTime + step * 0.045;
    const osc = c.createOscillator();
    const gain = c.createGain();

    const baseFreq = Math.min(950, 420 + step * 55);
    osc.type = "sine";
    osc.frequency.setValueAtTime(baseFreq, start);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.75, start + 0.07);

    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.15, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.085);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.095);
  }

  // Мягкий звук падения оторвавшихся шаров
  function playDrop() {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.22);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  return { playShoot, playBounce, playSquelch, playPop, playDrop };
})();

// Контроллер фоновой музыки (файл music.mp3 в корне проекта)
const BgMusic = (() => {
  const audio = new Audio("music.mp3");
  audio.loop = true;
  audio.volume = 0.35;
  let enabled = false;

  async function toggle() {
    if (enabled) {
      audio.pause();
      enabled = false;
      return false;
    } else {
      try {
        await audio.play();
        enabled = true;
        return true;
      } catch (e) {
        // Если файл music.mp3 ещё не загружен в папку
        enabled = false;
        return false;
      }
    }
  }

  return { toggle, isEnabled: () => enabled };
})();
