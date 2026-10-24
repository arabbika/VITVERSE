/**
 * Vitverse — Zen Sandbox Engine (Isometric v3.0)
 * Fixed: Offscreen sand canvas so rake marks persist, fixed centering.
 */
const ZenSandbox = (() => {
  let canvas, ctx;
  let sandCanvas, sandCtx; // Hidden canvas for the sand and rake marks
  
  let isDrawing = false;
  let lastX = 0, lastY = 0;
  let currentTool = 'rake'; 
  
  // Grid Settings
  const TILE_W = 64;
  const TILE_H = 32;
  const GRID_SIZE = 8; // Slightly larger grid
  let offsetX = 0, offsetY = 0;

  const images = {};
  const objects = []; 

  // Audio Setup
  let audioCtx = null;
  const scale = [261.63, 293.66, 329.63, 392.00, 440.00];
  let lastNoteTime = 0;

  function initAudio() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch(e) {}
  }

  function playNote(y, speed) {
    if (!audioCtx) return;
    const now = Date.now();
    if (now - lastNoteTime < 100) return; 
    lastNoteTime = now;
    
    const freq = scale[Math.floor(Math.random() * scale.length)];
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

  // --- Grid Math ---
  function toScreen(gx, gy) {
    return {
      x: (gx - gy) * (TILE_W / 2) + offsetX,
      y: (gx + gy) * (TILE_H / 2) + offsetY
    };
  }

  function toGrid(screenX, screenY) {
    const x = (screenX - offsetX) / (TILE_W / 2);
    const y = (screenY - offsetY) / (TILE_H / 2);
    return {
      gx: Math.round((x + y) / 2),
      gy: Math.round((y - x) / 2)
    };
  }

  // --- Image Loading ---
  function loadImages(callback) {
    const srcs = {
      tree: 'assets/tree.png',
      rock: 'assets/rock.png',
      bush: 'assets/bush.png',
      lantern: 'assets/lantern.png',
      pond: 'assets/pond.png'
    };
    let loaded = 0;
    const keys = Object.keys(srcs);

    keys.forEach(key => {
      images[key] = new Image();
      images[key].src = srcs[key];
      images[key].onload = () => { loaded++; if (loaded === keys.length) callback(); };
      images[key].onerror = () => { 
        console.warn(`Failed to load ${srcs[key]}`); 
        loaded++; 
        if (loaded === keys.length) callback(); 
      };
    });
  }

  // --- Drawing the Environment (ONLY DRAWN ONCE) ---
  function drawInitialSandAndFrame() {
    // 1. Base sand color
    sandCtx.fillStyle = '#e8dcc4';
    sandCtx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Procedural noise for sand grains
    sandCtx.fillStyle = 'rgba(0,0,0,0.04)';
    for(let i=0; i<canvas.width; i+=6) {
      for(let j=0; j<canvas.height; j+=6) {
        if (Math.random() > 0.5) {
          sandCtx.fillRect(i, j, 1.5, 1.5);
        }
      }
    }

    // 3. Draw Wooden Frame
    const pTop = toScreen(0, -GRID_SIZE);
    const pRight = toScreen(GRID_SIZE, 0);
    const pBottom = toScreen(0, GRID_SIZE);
    const pLeft = toScreen(-GRID_SIZE, 0);

    sandCtx.beginPath();
    sandCtx.moveTo(pTop.x, pTop.y);
    sandCtx.lineTo(pRight.x, pRight.y);
    sandCtx.lineTo(pBottom.x, pBottom.y);
    sandCtx.lineTo(pLeft.x, pLeft.y);
    sandCtx.closePath();

    sandCtx.strokeStyle = '#5c4033'; // Wood color
    sandCtx.lineWidth = 32;
    sandCtx.lineJoin = 'round';
    sandCtx.stroke();

    // Inner Shadow for depth
    sandCtx.strokeStyle = 'rgba(0,0,0,0.4)';
    sandCtx.lineWidth = 6;
    sandCtx.stroke();
  }

  // --- The Multi-Tooth Rake (DRAWS TO THE SAND CANVAS) ---
  function drawRake(x, y, speed) {
    const angle = Math.atan2(y - lastY, x - lastX);
    const perpAngle = angle + Math.PI / 2;
    
    // Draw 5 parallel grooves
    for (let i = -2; i <= 2; i++) {
      const offset = i * 8; // Space between teeth
      const ox = Math.cos(perpAngle) * offset;
      const oy = Math.sin(perpAngle) * offset;

      sandCtx.beginPath();
      sandCtx.moveTo(lastX + ox, lastY + oy);
      sandCtx.lineTo(x + ox, y + oy);
      
      // Groove Shadow
      sandCtx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
      sandCtx.lineWidth = 4;
      sandCtx.lineCap = 'round';
      sandCtx.stroke();

      // Groove Highlight
      sandCtx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      sandCtx.lineWidth = 2;
      sandCtx.stroke();
    }

    if (Math.random() < 0.2) playNote(y, speed);
  }

  // --- Render Loop ---
  function render() {
    // 1. Draw the static sand + raked lines
    ctx.drawImage(sandCanvas, 0, 0);

    // 2. Sort objects by depth (Y-axis)
    objects.sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));

    // 3. Draw Objects
    objects.forEach(obj => {
      const pos = toScreen(obj.gx, obj.gy);
      const img = images[obj.type];
      
      if (img && img.complete && img.naturalWidth > 0) {
        const scale = obj.type === 'pond' ? 0.35 : 0.22; 
        const sw = img.naturalWidth * scale;
        const sh = img.naturalHeight * scale;

        // Draw Drop Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y + TILE_H/2, sw * 0.35, TILE_H * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw Image (anchored at bottom-center)
        ctx.drawImage(img, pos.x - sw / 2, pos.y - sh + TILE_H, sw, sh);
      }
    });

    requestAnimationFrame(render);
  }

  // --- Interactions ---
  function handleStart(e) {
    if (e.cancelable) e.preventDefault(); 
    initAudio();
    
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const grid = toGrid(clientX - rect.left, clientY - rect.top);

    // Restrict placement to inside the grid
    if (Math.abs(grid.gx) > GRID_SIZE || Math.abs(grid.gy) > GRID_SIZE) return;

    if (currentTool !== 'rake') {
      // Remove existing object at this tile
      const existingIdx = objects.findIndex(o => o.gx === grid.gx && o.gy === grid.gy);
      if (existingIdx > -1) objects.splice(existingIdx, 1);
      
      // Add new object
      objects.push({ gx: grid.gx, gy: grid.gy, type: currentTool });
      playNote(clientY, 10); 
    } else {
      isDrawing = true;
      lastX = clientX - rect.left;
      lastY = clientY - rect.top;
    }
  }

  function handleMove(e) {
    if (!isDrawing || currentTool !== 'rake') return;
    if (e.cancelable) e.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const dist = Math.hypot(x - lastX, y - lastY);
    if (dist > 2) {
      drawRake(x, y, dist);
      lastX = x; lastY = y;
    }
  }

  function handleEnd() {
    isDrawing = false;
  }

  // --- Initialization ---
  function init() {
    canvas = document.getElementById('zen-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Create the hidden sand canvas
    sandCanvas = document.createElement('canvas');
    sandCanvas.width = canvas.width;
    sandCanvas.height = canvas.height;
    sandCtx = sandCanvas.getContext('2d');
    
    // Center the grid perfectly on the screen
    offsetX = canvas.width / 2;
    offsetY = canvas.height / 2 - 50; // Shifted up slightly for the toolbar

    // Draw the sand and the wooden frame ONCE
    drawInitialSandAndFrame();

    // Toolbar Setup
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (!e.currentTarget.dataset.tool) return; 
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentTool = e.currentTarget.dataset.tool;
      });
    });

    // Clear Button
    document.getElementById('zen-clear').addEventListener('click', () => {
      if (confirm("Clear the garden?")) {
        objects.length = 0;
        drawInitialSandAndFrame(); // Reset the sand too!
      }
    });

    // Event Listeners
    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    
    canvas.addEventListener('touchstart', handleStart, { passive: false });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    // Start the game loop
    loadImages(() => {
      requestAnimationFrame(render);
    });
  }

  return { init };
})();
