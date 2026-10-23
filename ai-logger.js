/**
 * Vitverse — AI Logger (Aura Integration)
 */
const AILogger = (() => {
  let isListening = false;
  let recognition = null;

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

  function formatAuraResponse(text) {
    const sections = text.split(/\*\*(.*?)\*\*/).filter(Boolean);
    let html = '<div class="aura-plan">';
    for (let i = 0; i < sections.length; i += 2) {
      let title = sections[i].trim();
      let content = sections[i + 1] ? sections[i + 1].trim() : '';
      let icon = '';
      let cssClass = 'phase-card';
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
    if (window.Companion) {
      window.dispatchEvent(new CustomEvent('companion:update', { detail: Companion.view() }));
    }
  }

  async function processText(text) {
    if (!text || text.trim() === '') return;
    const input = document.getElementById('ai-input');
    const bubble = document.getElementById('companion-memory');
    
    input.value = ''; 
    bubble.classList.remove('is-expanded');
    bubble.innerHTML = `<span style="color:var(--accent);"><i class="fa-solid fa-spinner fa-spin"></i> Aura is analyzing your brain dump...</span>`;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brainDump: text })
      });

      // Safely parse the response to prevent the "Unexpected token" error
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("Non-JSON response from server:", responseText);
        throw new Error("The server timed out or crashed. Check Vercel logs.");
      }
      
      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to get a response from Aura.");
      }

      bubble.innerHTML = formatAuraResponse(data.text);
      bubble.classList.add('is-expanded');

      if (window.Companion) {
        Companion.emit({ id: crypto.randomUUID(), type: 'REFLECTION_WRITTEN' });
        Companion.emit({ id: crypto.randomUUID(), type: 'TASK_COMPLETE' });
      }
      if (window.Juice) Juice.playPetSound();

    } catch (err) {
      bubble.classList.remove('is-expanded');
      bubble.innerHTML = `<span style="color:#ff4444;"><i class="fa-solid fa-triangle-exclamation"></i> ${err.message}</span>`;
    }
  }

  return { toggleMic, processText, dismiss };
})();
window.AILogger = AILogger;
