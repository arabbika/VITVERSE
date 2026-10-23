/**
 * Vitverse — AI Logger (Aura Integration)
 */
const AILogger = (() => {
  let isListening = false;
  let recognition = null;

  // Voice Setup
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

  // --- NEW: Parse Aura's Markdown into styled HTML cards ---
  function formatAuraResponse(text) {
    // Split by the bold markdown headers (e.g., **🎯 Anchor Objective:**)
    const sections = text.split(/\*\*(.*?)\*\*/).filter(Boolean);
    let html = '<div class="aura-plan">';
    
    // Sections alternate: [Header, Content, Header, Content...]
    for (let i = 0; i < sections.length; i += 2) {
      let title = sections[i].trim();
      let content = sections[i + 1] ? sections[i + 1].trim() : '';
      
      let icon = '';
      let cssClass = 'phase-card';
      
      if (title.includes('Anchor')) { 
        icon = '<i class="fa-solid fa-bullseye"></i>'; 
        cssClass += ' phase-objective'; 
      } else if (title.includes('Phase 1')) { 
        icon = '<i class="fa-solid fa-bolt"></i>'; 
        cssClass += ' phase-1'; 
      } else if (title.includes('Phase 2')) { 
        icon = '<i class="fa-solid fa-shield-halved"></i>'; 
        cssClass += ' phase-2'; 
      } else if (title.includes('Phase 3')) { 
        icon = '<i class="fa-solid fa-arrows-spin"></i>'; 
        cssClass += ' phase-3'; 
      } else if (title.includes('Somatic')) { 
        icon = '<i class="fa-solid fa-spa"></i>'; 
        cssClass += ' phase-somatic'; 
      }

      // Remove emojis from the title since we are using FontAwesome icons
      title = title.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').replace(':', '').trim();

      html += `
        <div class="${cssClass}">
          <div class="phase-title">${icon} ${title}</div>
          <div class="phase-content">${content}</div>
        </div>
      `;
    }
    html += '</div>';
    return html;
  }

  async function processText(text) {
    if (!text || text.trim() === '') return;
    
    const input = document.getElementById('ai-input');
    const bubble = document.getElementById('companion-memory');
    
    input.value = ''; 
    bubble.innerHTML = `<span style="color:var(--accent);"><i class="fa-solid fa-spinner fa-spin"></i> Aura is analyzing your brain dump...</span>`;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brainDump: text })
      });

      const data = await response.json();
      
      if (data.error) throw new Error(data.error);

      // Apply the beautiful formatting
      bubble.innerHTML = formatAuraResponse(data.text);
      
      // Expand the bubble for the complex plan
      bubble.classList.add('is-expanded');

      if (window.Companion) {
        Companion.emit({ id: crypto.randomUUID(), type: 'REFLECTION_WRITTEN' });
        Companion.emit({ id: crypto.randomUUID(), type: 'TASK_COMPLETE' });
      }

      if (window.Juice) Juice.playPetSound();

    } catch (err) {
      bubble.classList.remove('is-expanded');
      bubble.innerHTML = `<span style="color:#ff4444;">Error: ${err.message}</span>`;
    }
  }

  return { toggleMic, processText };
})();
window.AILogger = AILogger;
