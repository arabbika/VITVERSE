/**
 * Vitverse — AI Logger
 * Parses natural language and voice into companion events.
 */
const AILogger = (() => {
  let isListening = false;
  let recognition = null;

  // 1. Setup Voice Recognition (Web Speech API)
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      isListening = true;
      updateMicUI(true);
      updateStatusText("Listening...");
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      document.getElementById('ai-input').value = transcript;
      processText(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech error:", event.error);
      updateStatusText("Couldn't hear you. Try typing.");
      stopListening();
    };

    recognition.onend = () => {
      stopListening();
    };
  }

  function toggleMic() {
    if (!recognition) {
      alert("Voice input is not supported in this browser. Please type.");
      return;
    }
    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  }

  function stopListening() {
    isListening = false;
    updateMicUI(false);
  }

  function updateMicUI(active) {
    const micBtn = document.getElementById('ai-mic-btn');
    if (!micBtn) return;
    if (active) {
      micBtn.classList.add('listening');
      micBtn.style.color = '#ff4444'; // Red pulse
    } else {
      micBtn.classList.remove('listening');
      micBtn.style.color = 'var(--accent)'; // Back to blue
    }
  }

  function updateStatusText(text) {
    const bubble = document.getElementById('companion-memory');
    if (bubble) {
      bubble.innerHTML = `<span>${text}</span>`;
    }
  }

  // 2. The NLP Parser
  function processText(text) {
    const input = document.getElementById('ai-input');
    if (!text || text.trim() === '') return;
    
    input.value = ''; // Clear input
    updateStatusText("Analyzing your day...");
    
    // Simulate AI thinking delay for "magic" feel
    setTimeout(() => {
      const lower = text.toLowerCase();
      let eventsFound = [];
      let responseLines = [];

      // --- Parse Sleep ---
      const sleepMatch = lower.match(/(\d+(\.\d+)?)\s*(hours|hrs|h)\s*(of\s*)?(sleep)?/i);
      if (lower.includes('sleep') || lower.includes('slept') || lower.includes('bed') || sleepMatch) {
        let hours = sleepMatch ? parseFloat(sleepMatch[1]) : 7.5;
        let quality = 3;
        if (lower.includes('great') || lower.includes('good') || lower.includes('deep')) quality = 5;
        if (lower.includes('bad') || lower.includes('rough') || lower.includes('terrible')) quality = 1;

        eventsFound.push({ type: 'SLEEP_LOGGED', payload: { hours, quality } });
        responseLines.push(`logged ${hours}h of sleep`);
      }

      // --- Parse Mood ---
      if (lower.includes('anxious') || lower.includes('stressed') || lower.includes('worried') || lower.includes('sad')) {
        eventsFound.push({ type: 'MOOD_CHECKIN', payload: { value: 2 } });
        responseLines.push("noted you're feeling a bit low");
      } else if (lower.includes('happy') || lower.includes('great') || lower.includes('amazing') || lower.includes('good')) {
        eventsFound.push({ type: 'MOOD_CHECKIN', payload: { value: 5 } });
        responseLines.push("glad you're feeling great");
      }

      // --- Parse Breathing ---
      if (lower.includes('breath') || lower.includes('focus') || lower.includes('meditat') || lower.includes('calm')) {
        eventsFound.push({ type: 'BREATHE_COMPLETE', payload: { protocol: 'b478' } });
        responseLines.push("recorded a focus session");
      }

      // --- Parse Tasks/Work ---
      if (lower.includes('task') || lower.includes('work') || lower.includes('finish') || lower.includes('complete') || lower.includes('clean') || lower.includes('chore')) {
        eventsFound.push({ type: 'TASK_COMPLETE' });
        responseLines.push("completed a quest");
      }

      // --- Parse Exercise ---
      if (lower.includes('run') || lower.includes('walk') || lower.includes('gym') || lower.includes('exercise') || lower.includes('workout')) {
        eventsFound.push({ type: 'EXERCISE_LOGGED' });
        responseLines.push("logged your physical training");
      }

      // --- Execute Events ---
      if (eventsFound.length > 0) {
        eventsFound.forEach(ev => {
          Companion.emit({
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random(),
            type: ev.type,
            payload: ev.payload
          });
        });
        
        // Format the AI response
        const responseStr = responseLines.join(", and ");
        const xpGained = eventsFound.length * 50; // Rough estimate for the text
        
        updateStatusText(`Got it! I ${responseStr}. (+${xpGained} XP)`);
        if (window.Juice) Juice.playPetSound();

      } else {
        // If no keywords matched
        updateStatusText(`I didn't quite catch a specific action. Try saying "I slept 8 hours" or "I finished a task".`);
      }
    }, 800); // 800ms delay to feel like AI processing
  }

  return { toggleMic, processText };
})();
window.AILogger = AILogger;