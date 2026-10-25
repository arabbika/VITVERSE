// api/chat.js
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const maxDuration = 60;

const CRISIS_RESPONSE = {
  type: 'crisis',
  text: "I hear how much pain you are in. You don't have to carry this alone. Please reach out to people who can help right now.",
  resources: [
    { name: "Find A Helpline (Global)", contact: "findahelpline.com" },
    { name: "US & Canada", contact: "Call or text 988" },
    { name: "UK & Ireland", contact: "Call 116 123" },
    { name: "Australia", contact: "Call 13 11 14" }
  ],
  disclaimer: "If you are in immediate danger, please call your local emergency number (e.g., 911, 112, or 999)."
};

const str = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
function sanitize(p) {
  if (p?.type === 'crisis') return CRISIS_RESPONSE;
  if (p?.type === 'plan' && str(p.objective, 300) && Array.isArray(p.phases)) {
    return { 
      type: 'plan', 
      objective: str(p.objective, 300),
      phases: p.phases.slice(0, 3).map(x => ({ title: str(x.title, 60), content: str(x.content, 400) })),
      somatic: str(p.somatic, 300) 
    };
  }
  if (p?.type === 'empathy' && str(p.text, 600)) {
    return { type: 'empathy', text: str(p.text, 600) };
  }
  return null; 
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // --- GRACEFUL RATE LIMITING ---
  try {
    const rl = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(8, '1m'),
    });
    const ip = req.headers['x-forwarded-for']?.split(',')[0] ?? 'anon';
    const { success } = await rl.limit(ip);
    if (!success) return res.status(429).json({ error: 'Slow down a little. Try again in a minute.' });
  } catch (e) {
    // If Upstash fails, log it but DO NOT crash. Let the request through.
    console.warn("Rate limiter skipped (Upstash error):", e.message);
  }

  // --- INPUT VALIDATION ---
  const brainDump = typeof req.body?.brainDump === 'string' ? req.body.brainDump.trim() : '';
  if (!brainDump || brainDump.length > 2000) {
    return res.status(400).json({ error: 'Please keep your message under 2,000 characters.' });
  }

  // --- CRISIS DETECTION (Regex Layer 1) ---
  const crisisRegex = /\b(suicid\w*|kill(ing)? myself|end(ing)? (my life|it all)|take my own life|want(ed)? to die|don'?t want to (be here|live|wake up)|better off without me|hurt(ing)? myself|self[- ]?harm|cut(ting)? myself)\b/i;
  if (crisisRegex.test(brainDump)) {
    return res.status(200).json(CRISIS_RESPONSE);
  }

  // --- AI PERSONA ---
  const systemPrompt = `You are the AI core of Vitverse, a safe space for mental health and focus.
The user will give you a brain dump. You must decide if they need EMPATHY or a PLAN.

CRITICAL SAFETY RULES:
1. If the message suggests the user may harm themselves or others, you must respond with exactly: {"type":"crisis"} and nothing else.
2. Do not diagnose medical conditions. Do not give medical advice. Do not validate harmful beliefs.

Respond ONLY in valid JSON format matching one of these two structures:

If they need empathy:
{"type": "empathy", "text": "A warm, deeply validating 2-sentence response."}

If they need a plan:
{"type": "plan", "objective": "One sentence anchor goal.", "phases": [{"title": "Phase 1", "content": "Sprint."}, {"title": "Phase 2", "content": "Checkpoint."}, {"title": "Phase 3", "content": "Pivot."}], "somatic": "One sentence of physiological grounding."}`;

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.XAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        model: "grok-4.3", // Using the confirmed working model
        max_tokens: 600,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: brainDump }
        ]
      })
    });

    const rawText = await response.text(); 
    
    if (!response.ok) {
      console.error("xAI API Error Status:", response.status);
      return res.status(500).json({ error: 'AI failed to respond. Please try again.' });
    }

    const data = JSON.parse(rawText);
    const aiText = data.choices[0].message.content;
    
    try {
      const cleanJson = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      const safeData = sanitize(parsed);
      
      if (!safeData) throw new Error("Invalid schema");
      return res.status(200).json(safeData);
      
    } catch (e) {
      console.error("Failed to parse AI JSON. Status code:", response.status);
      return res.status(200).json({ 
        type: 'empathy', 
        text: "I'm here with you. Let's take a deep breath together." 
      });
    }

  } catch (error) {
    console.error("Serverless Function Error:", error.message);
    return res.status(500).json({ error: 'Aura crashed internally. Please try again.' });
  }
}
