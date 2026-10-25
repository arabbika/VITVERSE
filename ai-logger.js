/**
 * Vitverse — AI Logger (Unified & Secured)
 */
const AILogger = (() => {
  let isListening = false;
  let recognition = null;
  let isProcessing = false; // Prevents double-submit

  // Escape HTML to prevent XSS
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => { isListening = true; updateMicUI(true); };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      document.getElementById('ai-input').value = transcript;
      // We no longer auto-submit on voice, let them review the transcript first
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

  function triggerAbsorption() {
    const container = document.querySelector('.sanctuary-stage');
    const blob = document.getElementById('companion');
    if (!container || !blob) return;

    const blobRect = blob.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div');
      p.className = 'absorb-particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.top = Math.random() * 100 + '%';
      const dx = (blobRect.left + blobRect.width/2) - (containerRect.left + containerRect.width/2);
      const dy = (blobRect.top + blobRect.height/2) - (containerRect.top + containerRect.height/2);
      p.style.setProperty('--tx', `${dx}px`);
      p.style.setProperty('--ty', `${dy}px`);
      p.style.animationDelay = (Math.random() * 0.5) + 's';
      container.appendChild(p);
      setTimeout(() => p.remove(), 2000);
    }
  }

  function formatPlanResponse(data) {
    let html = '<div class="aura-plan">';
    html += `<div class="phase-card phase-objective"><div class="phase-title"><i class="fa-solid fa-bullseye"></i> Anchor Objective</div><div class="phase-content">${esc(data.objective)}</div></div>`;
    
    if (data.phases && Array.isArray(data.phases)) {
      data.phases.forEach((p, i) => {
        const icons = ['fa-bolt', 'fa-shield-halved', 'fa-arrows-spin'];
        const classes = ['phase-1', 'phase-2', 'phase-3'];
        html += `<div class="phase-card ${classes[i] || ''}"><div class="phase-title"><i class="fa-solid ${icons[i] || 'fa-circle'}"></i> ${esc(p.title)}</div><div class="phase-content">${esc(p.content)}</div></div>`;
      });
    }

    html += `<div class="phase-card phase-somatic"><div class="phase-title"><i class="fa-solid fa-spa"></i> Somatic Reset</div><div class="phase-content">${esc(data.somatic || 'Take a deep breath.')}</div></div>`;
    html += `<button class="dismiss-plan-btn" onclick="AILogger.dismiss()"><i class="fa-solid fa-check-circle"></i> Acknowledge & Return</button></div>`;
    return html;
  }

  function dismiss() {
    const bubble = document.getElementById('companion-memory');
    bubble.classList.remove('is-expanded');
    if (window.Companion) window.dispatchEvent(new CustomEvent('companion:update', { detail: Companion.view() }));
  }

  async function processText(text) {
    if (!text || text.trim() === '' || isProcessing) return;
    
    isProcessing = true;
    const input = document.getElementById('ai-input');
    const bubble = document.getElementById('companion-memory');
    const originalText = input.value;
    
    // Do NOT clear input yet
    bubble.classList.remove('is-expanded');
    bubble.innerHTML = `<span style="color:var(--accent);"><i class="fa-solid fa-spinner fa-spin"></i> Analyzing...</span>`;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brainDump: text })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      input.value = ''; // Clear only on success

      if (data.type === 'crisis') {
        bubble.innerHTML = `
          <span style="color:#ff4444; font-weight:bold;">${esc(data.text)}</span>
          <br><br>
          <div style="font-size:12px; line-height:1.6;">
            ${data.resources.map(r => `<b>${esc(r.name)}:</b> ${esc(r.contact)}`).join('<br>')}
          </div>
          <br>
          <div style="font-size:11px; color:var(--text-muted); font-style:italic;">
            ${esc(data.disclaimer)}
          </div>
        `;
      } 
      else if (data.type === 'empathy') {
        triggerAbsorption();
        bubble.innerHTML = `<span style="color:#ff8fb8; font-style:italic;">"${esc(data.text)}"</span>`;
        if (window.Juice) Juice.playPetSound();
      } 
      else if (data.type === 'plan') {
        bubble.innerHTML = formatPlanResponse(data);
        bubble.classList.add('is-expanded');
        if (window.Juice) Juice.playPetSound();
      }

      // Award XP
      if (window.Companion) {
        Companion.emit({ id: crypto.randomUUID(), type: 'REFLECTION_WRITTEN' });
      }

    } catch (err) {
      bubble.classList.remove('is-expanded');
      bubble.innerHTML = `<span style="color:#ff4444;"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(err.message)}</span>`;
      input.value = originalText; // Restore text on failure!
    } finally {
      isProcessing = false;
    }
  }

  return { toggleMic, processText, dismiss };
})();
window.AILogger = AILogger;
