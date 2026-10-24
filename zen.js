/**
 * Vitverse — Zen Sandbox Engine
 */
const ZenSandbox = (() => {
  const canvas = document.getElementById('zen-canvas');
  const ctx = canvas.getContext('2d');
  const STORAGE_KEY = 'vitverse.zen.garden.v1';
  
  let isDrawing = false;
  let lastX = 0, lastY = 0;
  let currentTool = 'rake'; // 'rake', 'stone', 'bonsai', 'pagoda'
  let sessionTimer = null;
  let zenMinutes = 0;

  // --- Audio Setup ---
  let audioCtx = null;
  const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25]; // C Major Pentatonic
  let lastNoteTime = 0;

  function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playNote(y, speed) {
    if (!audioCtx) return;
    const now = Date.now();
    if (now - lastNoteTime < 100) return; // Throttle notes so it's not overwhelming
    lastNoteTime = now;

    // Map Y position to a note in the scale
    const index = Math.floor((y / canvas.height) * scale.length);
    const freq = scale[Math.max(0, Math.min(scale.length - 1, index))];

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = freq;

    // Faster rake = louder note
    const volume = Math.min(0.1, Math.max(0.01, speed / 1000));
    
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 1.5);
  }

  // --- Canvas Setup ---
  function resizeCanvas() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (canvas.width > 0) tempCtx.drawImage(canvas, 0, 0);

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Fill with sand color
    ctx.fillStyle = '#e8e2d2'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (tempCanvas.width > 0) ctx.drawImage(tempCanvas, 0, 0);
    loadGarden();
  }

  // --- Drawing Logic ---
  function drawRake(x, y, speed) {
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    
    // Shadow
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 4;
    ctx.stroke();

    playNote(y, speed);
  }

  function placeObject(x, y) {
    const size = 40;
    ctx.font = `${size}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const icons = { stone: '🪨', bonsai: '🪴', pagoda: '🛕', blossom: '🌸' };
    ctx.fillText(icons[currentTool], x, y);
    
    // Deep gong sound
    if (audioCtx) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 130; // Low C
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 2);
    }
  }

  // --- Interaction Events ---
  function handleStart(e) {
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
    const { x, y } = getPos(e);
    
    // Calculate speed for audio volume
    const dist = Math.hypot(x - lastX, y - lastY);
    drawRake(x, y, dist);
    
    lastX = x; lastY = y;
  }

  function handleEnd() {
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
        ctx.drawImage(img, 0, 0);
      };
      img.src = saved;
    }
  }

  function clearGarden() {
    if (confirm("Smooth the sand and remove all objects?")) {
      ctx.fillStyle = '#e8e2d2';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // --- Session Timer (XP Rewards) ---
  function startSession() {
    sessionTimer = setInterval(() => {
      zenMinutes++;
      document.getElementById('zen-timer').textContent = `${zenMinutes}m`;
      
      // Give XP every minute
      if (window.Companion) {
        Companion.emit({ id: crypto.randomUUID(), type: 'ZEN_SESSION' });
        if (window.Juice) Juice.playPetSound();
      }
      
      // Update HUD text to show reward
      const toast = document.getElementById('zen-toast');
      toast.textContent = "+50 XP · +10 Calm";
      toast.style.opacity = 1;
      setTimeout(() => toast.style.opacity = 0, 2000);

    }, 60000); // 1 minute
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

      // Tool Selection
      document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
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