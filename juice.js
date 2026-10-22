/**
 * Vitverse — Game Juice
 * Adds audio, haptics, particles, and level-up overlays.
 */
const Juice = (() => {
  // 1. Web Audio API (Synth Sounds - No MP3s needed)
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  let audioCtx;

  function playTone(freq, type = 'sine', duration = 0.1) {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  function playPetSound() { playTone(600, 'sine', 0.1); }
  function playLevelUpSound() { 
    playTone(440, 'triangle', 0.2); 
    setTimeout(() => playTone(554, 'triangle', 0.2), 100);
    setTimeout(() => playTone(659, 'triangle', 0.4), 200);
  }

  // 2. Haptics
  function vibrate(ms = 50) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  // 3. Level Up Overlay
  function showLevelUp(level) {
    playLevelUpSound();
    vibrate([100, 50, 100, 50, 200]);

    const overlay = document.createElement('div');
    overlay.className = 'level-up-overlay';
    overlay.innerHTML = `
      <div class="level-up-text">LEVEL UP</div>
      <div class="level-up-number">${level}</div>
      <button class="level-up-btn" onclick="this.parentElement.remove()">Continue</button>
    `;
    document.body.appendChild(overlay);

    // Generate confetti
    for (let i = 0; i < 50; i++) {
      const conf = document.createElement('div');
      conf.className = 'confetti';
      conf.style.left = Math.random() * 100 + 'vw';
      conf.style.animationDelay = Math.random() * 2 + 's';
      conf.style.backgroundColor = ['#00bfff', '#ffd700', '#ff8fb8', '#4ade80'][Math.floor(Math.random() * 4)];
      overlay.appendChild(conf);
    }
  }

  // 4. Ambient Particles
  function initParticles() {
    const stage = document.getElementById('sanctuary');
    if (!stage) return;
    for (let i = 0; i < 15; i++) {
      const p = document.createElement('div');
      p.className = 'ambient-particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.top = Math.random() * 100 + '%';
      p.style.animationDuration = (3 + Math.random() * 4) + 's';
      p.style.animationDelay = Math.random() * 2 + 's';
      stage.appendChild(p);
    }
  }

  // Track level changes
  let currentLevel = 1;
  function checkLevelUp(view) {
    if (view.level > currentLevel) {
      currentLevel = view.level;
      showLevelUp(view.level);
    } else {
      currentLevel = view.level;
    }
  }

  return { playPetSound, vibrate, checkLevelUp, initParticles };
})();
window.Juice = Juice;