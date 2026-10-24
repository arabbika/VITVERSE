/**
 * Vitverse — Zen Sandbox Engine (v2.0)
 * Fixed: High-DPI scaling, mobile touch preventDefault, tool locking bug.
 */
const ZenSandbox = (() => {
  const canvas = document.getElementById('zen-canvas');
  const ctx = canvas.getContext('2d');
  const STORAGE_KEY = 'vitverse.zen.garden.v2';
  
  let isDrawing = false;
  let lastX = 0, lastY = 0;
  let currentTool = 'rake'; 
  let zenMinutes = 0;
  let sessionTimer = null;
  let dpr = window.devicePixelRatio || 1;

  // --- Audio Setup ---
  let audioCtx = null;
  const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25]; // C Major Pentatonic
  let lastNoteTime = 0;

  function initAudio() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {
      console.warn("Audio not supported", e);
    }
  }

  function playNote(y, speed) {
    if (!audioCtx) return;
    const now = Date.now();
    if (now - lastNoteTime < 100) return; 
    lastNoteTime = now;

    const index = Math.floor((y / window.innerHeight) * scale.length);
    const freq = scale[Math.max(0, Math.min(scale.length - 1, index))];

    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;

      const volume = Math.min(0.1, Math.max(0.01, speed / 1000));
      
      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.5);
    } catch(e) {}
  }

  // --- Canvas Setup (High DPI Support) ---
  function resizeCanvas() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (canvas.width > 0) tempCtx.drawImage(canvas, 0, 0);

    dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#e8e2d2'; 
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    if (tempCanvas.width > 0) {
      ctx.drawImage(tempCanvas, 0, 0, window.innerWidth, window.innerHeight);
    } else {
      loadGarden();
    }
  }

  // --- Drawing Logic ---
  function drawRake(x, y, speed) {
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    
    // Groove shadow
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Groove highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 4;
    ctx.stroke();

    playNote(y, speed);
  }

  function placeObject(x, y) {
    const size = 40;
    ctx.font = `${size}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const icons = { stone: '🪨', bonsai: '🪴', blossom: '🌸' };
    if (!icons[currentTool]) return; // Failsafe
    
    ctx.fillText(icons[currentTool], x, y);
    
    // Deep gong sound
    if (audioCtx) {
      try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 130; 
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 2);
      } catch(e) {}
    }
  }

  // --- Interaction Events ---
  function handleStart(e) {
    if (e.cancelable) e.preventDefault(); // Stop mobile scrolling
    initAudio();
    const { x, y } = getPos(e);
    isDrawing = true;
    lastX = x; lastY = y;
    
    if (currentTool !== 'rake') {
      placeObject(x, y);
      saveGarden();
      isDrawing = false;
    }
  }

  function handleMove(e) {
    if (!isDrawing || currentTool !== 'rake') return;
    if (e.cancelable) e.preventDefault();
    
    const { x, y } = getPos(e);
    const dist = Math.hypot(x - lastX, y - lastY);
    
    drawRake(x, y, dist);
    
    lastX = x; lastY = y;
  }

  function handleEnd(e) {
    if (isDrawing && currentTool === 'rake') saveGarden();
    isDrawing = false;
  }

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  // --- Persistence ---
  function saveGarden() {
    try {
      localStorage.setItem(STORAGE_KEY, canvas.toDataURL());
    } catch (e) { console.warn('Failed to save garden', e); }
  }

  function loadGarden() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, window.innerWidth, window.innerHeight);
      };
      img.src = saved;
    }
  }

  function clearGarden() {
    if (confirm("Smooth the sand and remove all objects?")) {
      ctx.fillStyle = '#e8e2d2';
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // --- Session Timer (XP Rewards) ---
  function startSession() {
    sessionTimer = setInterval(() => {
      zenMinutes++;
      document.getElementById('zen-timer').textContent = `${zenMinutes}m`;
      
      if (window.Companion) {
        Companion.emit({ id: crypto.randomUUID(), type: 'ZEN_SESSION' });
        if (window.Juice) Juice.playPetSound();
      }
      
      const toast = document.getElementById('zen-toast');
      toast.textContent = "+50 XP · +10 Calm";
      toast.style.opacity = 1;
      setTimeout(() => toast.style.opacity = 0, 2000);

    }, 60000); 
  }

  // --- Initialization ---
  return {
    init() {
      window.addEventListener('resize', resizeCanvas);
      resizeCanvas();
      
      canvas.addEventListener('mousedown', handleStart);
      canvas.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      
      canvas.addEventListener('touchstart', handleStart, { passive: false });
      canvas.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleEnd);

      document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          // CRITICAL FIX: Prevent "Clear" from setting tool to undefined
          if (!e.currentTarget.dataset.tool) return; 
          
          document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
          e.currentTarget.classList.add('active');
          currentTool = e.currentTarget.dataset.tool;
        });
      });

      document.getElementById('zen-clear').addEventListener('click', clearGarden);
      startSession();
    }
  };
})();
