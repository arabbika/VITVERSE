/**
 * Vitverse — Zen Sandbox Engine (Isometric v2.0)
 * Includes: Sand texture, Wooden frame, Multi-tooth rake, Drop shadows.
 */
const ZenSandbox = (() => {
  let canvas, ctx;
  let isDrawing = false;
  let lastX = 0, lastY = 0;
  let currentTool = 'rake'; 
  
  // Grid Settings
  const TILE_W = 64;
  const TILE_H = 32;
  const GRID_SIZE = 7; // How many tiles from the center
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

  // --- Drawing the Environment ---
  function drawSandBase() {
    // 1. Base sand color
    ctx.fillStyle = '#e8dcc4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Procedural noise for sand grains (performance optimized)
    ctx.fillStyle = 'rgba(0,0,0,0.04)';
    for(let i=0; i<canvas.width; i+=6) {
      for(let j=0; j<canvas.height; j+=6) {
        if (Math.random() > 0.5) {
          ctx.fillRect(i, j, 1.5, 1.5);
        }
      }
    }
  }

  function drawWoodenFrame() {
    const pTop = toScreen(0, -GRID_SIZE);
    const pRight = toScreen(GRID_SIZE, 0);
    const pBottom = toScreen(0, GRID_SIZE);
    const pLeft = toScreen(-GRID_SIZE, 0);

    // Draw Wooden Border
    ctx.beginPath();
    ctx.moveTo(pTop.x, pTop.y);
    ctx.lineTo(pRight.x, pRight.y);
    ctx.lineTo(pBottom.x, pBottom.y);
    ctx.lineTo(pLeft.x, pLeft.y);
    ctx.closePath();

    ctx.strokeStyle = '#5c4033'; // Wood color
    ctx.lineWidth = 32;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Inner Shadow for depth
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 6;
    ctx.stroke();
  }

  // --- The Multi-Tooth Rake ---
  function drawRake(x, y, speed) {
    const angle = Math.atan2(y - lastY, x - lastX);
    const perpAngle = angle + Math.PI / 2;
    
    // Draw 5 parallel grooves
    for (let i = -2; i <= 2; i++) {
      const offset = i * 8; // Space between teeth
      const ox = Math.cos(perpAngle) * offset;
      const oy = Math.sin(perpAngle) * offset;

      ctx.beginPath();
      ctx.moveTo(lastX + ox, lastY + oy);
      ctx.lineTo(x + ox, y + oy);
      
      // Groove Shadow
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Groove Highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (Math.random() < 0.2) playNote(y, speed);
  }

  // --- Render Loop ---
  function render() {
    // 1. Reset environment
    drawSandBase();
    drawWoodenFrame();

    // 2. Sort objects by depth (Y-axis)
    objects.sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));

    // 3. Draw Objects
    objects.forEach(obj => {
      const pos = toScreen(obj.gx, obj.gy);
      const img = images[obj.type];
      
      if (img && img.complete && img.naturalWidth > 0) {
        // Scale object based on type
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

    // Restrict to inside the wooden frame
    if (Math.abs(grid.gx) > GRID_SIZE || Math.abs(grid.gy) > GRID_SIZE) return;

    if (currentTool !== 'rake') {
      // Remove existing object at this tile to prevent overlapping
      const existingIdx = objects.findIndex(o => o.gx === grid.gx && o.gy === grid.gy);
      if (existingIdx > -1) objects.splice(existingIdx, 1);
      
      // Add new object
      objects.push({ gx: grid.gx, gy: grid.gy, type: currentTool });
      playNote(clientY, 10); // Play sound on drop
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
    
    // Center the isometric grid
    offsetX = canvas.width / 2;
    offsetY = canvas.height / 5;

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
      if (confirm("Clear the garden?")) objects.length = 0;
    });

    // Event Listeners (Mouse & Touch)
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
