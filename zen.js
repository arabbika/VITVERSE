/**
 * Vitverse — Zen Sandbox Engine (v3.0)
 * Fixed: DOM loading order, canvas initialization.
 */
const ZenSandbox = (() => {
  let canvas, ctx;
  const STORAGE_KEY = 'vitverse.zen.garden.v3';
  
  let isDrawing = false;
  let lastX = 0, lastY = 0;
  let currentTool = 'rake'; 
  let zenMinutes = 0;
  let sessionTimer = null;
  let dpr = 1;

  // --- Audio Setup ---
  let audioCtx = null;
  const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25]; 
  let lastNoteTime = 0;

  function initAudio() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
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

  // --- Canvas Setup ---
  function resizeCanvas() {
    if (!canvas) return;
    
    dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#e8e2d2'; 
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    loadGarden();
  }

  // --- Drawing Logic ---
  function drawRake(x, y, speed) {
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    
    // Darker shadow for visibility
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Bright highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 5;
    ctx.stroke();

    playNote(y, speed);
  }

  function placeObject(x, y) {
    const size = 40;
    ctx.font = `${size}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const icons = { stone: '🪨', bonsai: '🪴', blossom: '🌸' };
    if (!icons[currentTool]) return;
    
    ctx.fillText(icons[currentTool], x, y);
    
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
    if (e.cancelable) e.preventDefault(); 
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
    } catch (e) {}
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

  // --- Session Timer ---
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
      // Find the canvas HERE, not at the top of the file
      canvas = document.getElementById('zen-canvas');
      if (!canvas) {
        console.error("Zen Sandbox: Canvas element not found!");
        return;
      }
      ctx = canvas.getContext('2d');

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
