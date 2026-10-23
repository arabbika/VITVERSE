// api/chat.js
export const maxDuration = 60; 

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { brainDump, mode } = req.body;
  if (!brainDump) return res.status(400).json({ error: 'No input provided' });

  // Setup the prompt based on the mode
  let systemPrompt = "";
  
  if (mode === 'whisper') {
    systemPrompt = `You are a compassionate, non-judgmental confidant. The user is whispering a secret, a fear, or venting. 
Listen deeply, validate their feelings, and offer a gentle, grounding response. 
Do NOT offer tactical plans, to-do lists, or game plans. Keep it brief (2-3 sentences max), warm, and empathetic. 
Acknowledge that this is a safe space.`;
  } else {
    systemPrompt = `You are Aura, an expert strategic operational co-pilot inside the Vitverse RPG app. 
The user will give you a 'Brain Dump' of everything overwhelming them. 
You must strip away panic and output a structured, zero-stress execution game plan.

Format your response EXACTLY like this (use markdown):
**🎯 Anchor Objective:** [One sentence identifying the single high-impact outcome]
**🌪️ Phase 1 (Core Action):** [Low-friction sprint]
**🛡️ Phase 2 (Validation Gate):** [Checkpoints]
**🔄 Phase 3 (Iteration):** [Pivot logic]
**🧘 Somatic Reset:** [One sentence of physiological grounding]

Keep it brief, highly actionable, and supportive. Do not output anything outside this format.`;
  }

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.XAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "grok-4.3", // Your working model
        max_tokens: 800,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: brainDump }
        ]
      })
    });

    const rawText = await response.text(); 
    if (!response.ok) return res.status(500).json({ error: `xAI Error: ${response.status}` });

    const data = JSON.parse(rawText);
    const text = data.choices[0].message.content;
    const xpReward = mode === 'whisper' ? 30 : 100; // Whispering gives a little XP

    res.status(200).json({ text, xpReward });
  } catch (error) {
    console.error("Serverless Function Error:", error);
    res.status(500).json({ error: 'Aura crashed internally. Please try again.' });
  }
}
