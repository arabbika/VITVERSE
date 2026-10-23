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

  async function processText(text) {
    if (!text || text.trim() === '') return;
    
    const input = document.getElementById('ai-input');
    const bubble = document.getElementById('companion-memory');
    
    input.value = ''; 
    // SHOW THE LOADING SPINNER
    bubble.innerHTML = `<span style="color:var(--accent);"><i class="fa-solid fa-spinner fa-spin"></i> Aura is analyzing your brain dump...</span>`;

    try {
      // CALL THE VERCEL BACKEND
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brainDump: text })
      });

      const data = await response.json();
      
      if (data.error) throw new Error(data.error);

      // SHOW THE AURA RESPONSE
      const formattedText = data.text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
      
      bubble.innerHTML = formattedText;
      
      // Award XP
      if (window.Companion) {
        Companion.emit({ id: crypto.randomUUID(), type: 'REFLECTION_WRITTEN' });
        Companion.emit({ id: crypto.randomUUID(), type: 'TASK_COMPLETE' });
      }

      if (window.Juice) Juice.playPetSound();

    } catch (err) {
      bubble.innerHTML = `<span style="color:#ff4444;">Error: ${err.message}</span>`;
    }
  }

  return { toggleMic, processText };
})();
window.AILogger = AILogger;
