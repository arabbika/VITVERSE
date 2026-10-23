const AILogger = (() => {
  let isListening = false;
  let recognition = null;
  let currentMode = 'aura'; // 'aura' or 'whisper'

  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => { isListening = true; updateMicUI(true); };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      document.getElementById('ai-input').value = transcript;
      processText(transcript);
    };
    recognition.onend = () => { isListening = false; updateMicUI(false); };
  }

  function toggleMic() {
    if (!recognition) return alert("Voice not supported.");
    if (isListening) recognition.stop();
    else recognition.start();
  }

  function updateMicUI(active) {
    const micBtn = document.getElementById('ai-mic-btn');
    if (!micBtn) return;
    if (active) { micBtn.classList.add('listening'); micBtn.style.color = '#ff4444'; }
    else { micBtn.classList.remove('listening'); micBtn.style.color = 'var(--accent)'; }
  }

  function setMode(mode) {
    currentMode = mode;
    const input = document.getElementById('ai-input');
    const tactBtn = document.getElementById('mode-tactician');
    const confBtn = document.getElementById('mode-confidant');
    
    if (mode === 'whisper') {
      input.placeholder = "Whisper your thoughts... they stay here.";
      input.style.color = "#ff8fb8";
      confBtn.classList.add('active');
      tactBtn.classList.remove('active');
    } else {
      input.placeholder = "e.g. Slept 8 hours, feeling great...";
      input.style.color = "var(--text-main)";
      tactBtn.classList.add('active');
      confBtn.classList.remove('active');
    }
  }

  // Creates the particle absorption effect
  function triggerAbsorption() {
    const container = document.querySelector('.sanctuary-stage');
    const blob = document.getElementById('companion');
    if (!container || !blob) return;

    const blobRect = blob.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div');
      p.className = 'absorb-particle';
      
      // Start at random positions on screen
      p.style.left = Math.random() * 100 + '%';
      p.style.top = Math.random() * 100 + '%';
      
      // Calculate vector towards blob center
      const dx = (blobRect.left + blobRect.width/2) - (containerRect.left + containerRect.width/2);
      const dy = (blobRect.top + blobRect.height/2) - (containerRect.top + containerRect.height/2);
      
      p.style.setProperty('--tx', `${dx}px`);
      p.style.setProperty('--ty', `${dy}px`);
      p.style.animationDelay = (Math.random() * 0.5) + 's';
      
      container.appendChild(p);
      setTimeout(() => p.remove(), 2000);
    }
  }

  function formatAuraResponse(text) {
    const sections = text.split(/\*\*(.*?)\*\*/).filter(Boolean);
    let html = '<div class="aura-plan">';
    for (let i = 0; i < sections.length; i += 2) {
      let title = sections[i].trim();
      let content = sections[i + 1] ? sections[i + 1].trim() : '';
      let icon = ''; let cssClass = 'phase-card';
      if (title.includes('Anchor')) { icon = '<i class="fa-solid fa-bullseye"></i>'; cssClass += ' phase-objective'; }
      else if (title.includes('Phase 1')) { icon = '<i class="fa-solid fa-bolt"></i>'; cssClass += ' phase-1'; }
      else if (title.includes('Phase 2')) { icon = '<i class="fa-solid fa-shield-halved"></i>'; cssClass += ' phase-2'; }
      else if (title.includes('Phase 3')) { icon = '<i class="fa-solid fa-arrows-spin"></i>'; cssClass += ' phase-3'; }
      else if (title.includes('Somatic')) { icon = '<i class="fa-solid fa-spa"></i>'; cssClass += ' phase-somatic'; }
      title = title.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').replace(':', '').trim();
      html += `<div class="${cssClass}"><div class="phase-title">${icon} ${title}</div><div class="phase-content">${content}</div></div>`;
    }
    html += `<button class="dismiss-plan-btn" onclick="AILogger.dismiss()"><i class="fa-solid fa-check-circle"></i> Acknowledge & Return</button></div>`;
    return html;
  }

  function dismiss() {
    const bubble = document.getElementById('companion-memory');
    bubble.classList.remove('is-expanded');
    if (window.Companion) window.dispatchEvent(new CustomEvent('companion:update', { detail: Companion.view() }));
  }

  async function processText(text) {
    if (!text || text.trim() === '') return;
    const input = document.getElementById('ai-input');
    const bubble = document.getElementById('companion-memory');
    
    input.value = ''; 
    
    if (currentMode === 'whisper') {
      triggerAbsorption();
      bubble.innerHTML = `<span style="color:#ff8fb8;"><i class="fa-solid fa-spinner fa-spin"></i> The sanctuary absorbs your whisper...</span>`;
    } else {
      bubble.classList.remove('is-expanded');
      bubble.innerHTML = `<span style="color:var(--accent);"><i class="fa-solid fa-spinner fa-spin"></i> Aura is analyzing your brain dump...</span>`;
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brainDump: text, mode: currentMode })
      });

      const responseText = await response.text();
      let data;
      try { data = JSON.parse(responseText); } 
      catch (e) { throw new Error("The server timed out or crashed."); }
      
      if (!response.ok || data.error) throw new Error(data.error || "Failed to get a response.");

      if (currentMode === 'whisper') {
        // Whisper response is just text
        bubble.innerHTML = `<span style="color:#ff8fb8; font-style:italic;">"${data.text}"</span>`;
      } else {
        // Tactician response is the game plan
        bubble.innerHTML = formatAuraResponse(data.text);
        bubble.classList.add('is-expanded');
      }

      if (window.Companion) {
        Companion.emit({ id: crypto.randomUUID(), type: 'REFLECTION_WRITTEN' });
      }
      if (window.Juice) Juice.playPetSound();

    } catch (err) {
      bubble.classList.remove('is-expanded');
      bubble.innerHTML = `<span style="color:#ff4444;"><i class="fa-solid fa-triangle-exclamation"></i> ${err.message}</span>`;
    }
  }

  return { toggleMic, processText, dismiss, setMode };
})();
window.AILogger = AILogger;
