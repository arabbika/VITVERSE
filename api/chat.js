// api/chat.js
export const maxDuration = 60; 

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { brainDump } = req.body;
  if (!brainDump) return res.status(400).json({ error: 'No input provided' });

  // =========================================================
  // 1. CRISIS DETECTION (Safety First & Globally Generic)
  // =========================================================
  const crisisRegex = /(suicide|kill myself|end it|want to die|hurt myself|self harm)/i;
  
  if (crisisRegex.test(brainDump)) {
    return res.status(200).json({
      type: 'crisis',
      text: "I hear how much pain you are in. You don't have to carry this alone. Please reach out to people who can help right now.",
      resources: [
        { 
          name: "Find A Helpline (Global Directory)", 
          contact: "findahelpline.com" 
        },
        { 
          name: "UK & Ireland (Samaritans)", 
          contact: "Call 116 123" 
        },
        { 
          name: "Canada (Talk Suicide)", 
          contact: "Call or text 988" 
        },
        { 
          name: "Australia (Lifeline)", 
          contact: "Call 13 11 14" 
        }
      ],
      disclaimer: "If you are in immediate danger, please call your local emergency number (e.g., 911, 112, or 999)."
    });
  }

  // =========================================================
  // 2. AI PERSONA & SYSTEM PROMPT
  // =========================================================
  const systemPrompt = `You are the AI core of Vitverse, a safe space for mental health and focus.
The user will give you a brain dump. You must decide if they need EMPATHY (a listening ear) or a PLAN (tactical steps).

CRITICAL: You must respond ONLY with a valid JSON object. Do NOT wrap it in markdown code blocks (like \`\`\`json). Do NOT include any text outside the JSON. 

If they need empathy/venting, use this exact structure:
{
  "type": "empathy",
  "text": "A warm, deeply validating 2-sentence response that acknowledges their feelings."
}

If they need a plan/tasks, use this exact structure:
{
  "type": "plan",
  "objective": "One sentence anchor goal.",
  "phases": [
    { "title": "Phase 1", "content": "Low-friction sprint." },
    { "title": "Phase 2", "content": "Validation checkpoint." },
    { "title": "Phase 3", "content": "Pivot logic." }
  ],
  "somatic": "One sentence of physiological grounding."
}`;

  // =========================================================
  // 3. xAI API CALL
  // =========================================================
  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.XAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      // Abort if xAI takes longer than 25 seconds (prevents Vercel timeout crash)
      signal: AbortSignal.timeout(25000), 
      body: JSON.stringify({
        model: "grok-4.7", // Ensure this is the model your xAI account has access to
        max_tokens: 600,
        temperature: 0.7,
        response_format: { type: "json_object" }, // Force JSON mode
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: brainDump }
        ]
      })
    });

    const rawText = await response.text(); 
    
    if (!response.ok) {
      console.error("xAI Error Status:", response.status);
      console.error("xAI Error Body:", rawText);
      return res.status(500).json({ error: 'AI failed to respond. Please try again.' });
    }

    const data = JSON.parse(rawText);
    const aiText = data.choices[0].message.content;
    
    // =========================================================
    // 4. PARSE AI RESPONSE
    // =========================================================
    try {
      // Sometimes AI still wraps in markdown, so we strip it just in case
      const cleanJson = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      return res.status(200).json(parsed);
    } catch (e) {
      console.error("Failed to parse AI JSON:", aiText);
      // Fallback if the AI hallucinates bad JSON
      return res.status(200).json({ 
        type: 'empathy', 
        text: "I'm here with you. Let's take a deep breath together." 
      });
    }

  } catch (error) {
    console.error("Serverless Function Error:", error);
    
    // Handle Timeout specifically
    if (error.name === 'TimeoutError') {
      return res.status(504).json({ error: 'Aura is thinking too hard. Please try a shorter message.' });
    }
    
    return res.status(500).json({ error: 'Aura crashed internally. Please try again.' });
  }
}
