/**
 * Vitverse — Ambient Sound Engine
 * Generates procedural soundscapes based on dominant stats.
 */
const SanctuaryAudio = (() => {
  let audioCtx = null;
  let currentNodes = [];
  let isPlaying = false;
  let currentMode = null;

  function init() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function stop() {
    currentNodes.forEach(node => {
      if (node.stop) node.stop();
      if (node.disconnect) node.disconnect();
    });
    currentNodes = [];
    isPlaying = false;
    currentMode = null;
    document.getElementById('audio-btn').classList.remove('playing');
  }

  // Generates a buffer of white noise
  function createNoiseBuffer() {
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function playOceanic() {
    const noise = audioCtx.createBufferSource();
    noise.buffer = createNoiseBuffer();
    noise.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    const gain = audioCtx.createGain();
    gain.gain.value = 0.5;

    // LFO for wave swelling
    const lfo = audioCtx.createOscillator();
    lfo.frequency.value = 0.1;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 0.3;

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    noise.start();
    lfo.start();
    currentNodes.push(noise, lfo, gain, filter);
  }

  function playCosmic() {
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    osc1.type = 'sine'; osc2.type = 'sine';
    osc1.frequency.value = 50; // Deep hum
    osc2.frequency.value = 50.5; // Slight detune for space feel

    const gain = audioCtx.createGain();
    gain.gain.value = 0.2;

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);

    osc1.start(); osc2.start();
    currentNodes.push(osc1, osc2, gain);
  }

  function playElectric() {
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 60;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;

    const gain = audioCtx.createGain();
    gain.gain.value = 0.1;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    currentNodes.push(osc, filter, gain);
  }

  function playBloom() {
    // Random gentle chimes
    const playChime = () => {
      if (!isPlaying) return;
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      // Pentatonic scale frequencies
      const notes = [261.63, 293.66, 329.63, 392.00, 440.00];
      osc.frequency.value = notes[Math.floor(Math.random() * notes.length)];

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 3);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 3);
      
      setTimeout(playChime, 2000 + Math.random() * 3000);
    };
    playChime();
  }

  function toggle(dominantStat) {
    if (isPlaying && currentMode === dominantStat) {
      stop();
      return;
    }
    stop();
    init();
    isPlaying = true;
    currentMode = dominantStat;
    document.getElementById('audio-btn').classList.add('playing');

    if (dominantStat === 'calm') playOceanic();
    else if (dominantStat === 'rest') playCosmic();
    else if (dominantStat === 'energy') playElectric();
    else playBloom();
  }

  return { toggle };
})();
window.SanctuaryAudio = SanctuaryAudio;