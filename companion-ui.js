/**
 * CompanionUI — mounts the SVG companion and reacts to state changes.
 * No numbers are ever shown. Posture + face + motion + speech are the readout.
 */
const CompanionUI = (() => {
  let svg;

  function mount(el) {
    svg = el;
    render(Companion.view());
    Companion.subscribe(render);
    
    // Re-render every 5 seconds so decay and resting states update while the page is idle
    setInterval(() => render(Companion.view()), 5_000);

    // Dedicated random blinking loop (every 3 to 7 seconds)
    function scheduleBlink() {
      const delay = 3000 + Math.random() * 4000;
      setTimeout(() => {
        if (!svg.classList.contains('is-resting')) {
          svg.classList.add('is-blinking');
          setTimeout(() => svg.classList.remove('is-blinking'), 200);
        }
        scheduleBlink(); // loop
      }, delay);
    }
    scheduleBlink();
  }

  function render(v) {
    if (!svg) return;
    
    // Apply state to SVG dataset for CSS to read
    svg.dataset.mood   = v.moodWord;
    svg.dataset.energy = v.energyBand;
    svg.dataset.breath = v.breathSync;
    // Cap visual level at 4 so the Crown is the final cosmetic unlock
    svg.dataset.level  = Math.min(v.level, 4); 
    
    svg.classList.toggle('is-resting', v.isResting);

    // Breathing and bobbing speeds (mapped to CSS variables)
    const breath = { slow: '8s', even: '6s', shallow: '4s' }[v.breathSync];
    const bob    = { bouncy: '1.6s', steady: '2.4s', slow: '4s' }[v.energyBand];
    const glow   = 3 + Math.min(v.level, 4) * 2;

    svg.style.setProperty('--breath-duration', breath);
    svg.style.setProperty('--bob-duration',    bob);
    svg.style.setProperty('--glow',           `${glow}px`);

    // Update the memory speech bubble smoothly
    const bubble = document.getElementById('companion-memory');
    if (bubble && bubble.textContent !== v.memory) {
      bubble.style.opacity = 0;
      setTimeout(() => {
        bubble.textContent = v.memory;
        bubble.style.opacity = 1;
      }, 300);
    }
  }

  return { mount };
})();

window.CompanionUI = CompanionUI;
