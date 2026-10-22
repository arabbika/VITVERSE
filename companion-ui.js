const CompanionUI = (() => {
  let svg;

  function mount(el) {
    svg = el;
    render(Companion.view());
    Companion.subscribe(render);
    setInterval(() => render(Companion.view()), 5_000);

    // Blinking loop
    function scheduleBlink() {
      const delay = 3000 + Math.random() * 4000;
      setTimeout(() => {
        if (!svg.classList.contains('is-resting')) {
          svg.classList.add('is-blinking');
          setTimeout(() => svg.classList.remove('is-blinking'), 200);
        }
        scheduleBlink();
      }, delay);
    }
    scheduleBlink();
  }

  function render(v) {
    if (!svg) return;
    
    svg.dataset.mood   = v.moodWord;
    svg.dataset.energy = v.energyBand;
    svg.dataset.breath = v.breathSync;
    svg.dataset.cosmetic = v.equipped || ''; // Sets the equipped loot
    
    svg.classList.toggle('is-resting', v.isResting);

    const breath = { slow: '8s', even: '6s', shallow: '4s' }[v.breathSync];
    const bob    = { bouncy: '1.6s', steady: '2.4s', slow: '4s' }[v.energyBand];
    const glow   = 3 + (v.level * 1.5); // Glow scales with Level now

    svg.style.setProperty('--breath-duration', breath);
    svg.style.setProperty('--bob-duration',    bob);
    svg.style.setProperty('--glow',           `${glow}px`);
  }

  return { mount };
})();
window.CompanionUI = CompanionUI;
