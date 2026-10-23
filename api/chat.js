// api/chat.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { brainDump } = req.body;
  if (!brainDump) return res.status(400).json({ error: 'No input provided' });

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.XAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "grok-4.3", 
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content: `You are Aura, an expert strategic operational co-pilot inside the Vitverse RPG app. 
The user will give you a 'Brain Dump' of everything overwhelming them. 
You must strip away panic and output a structured, zero-stress execution game plan.

Format your response EXACTLY like this (use markdown):
**🎯 Anchor Objective:** [One sentence identifying the single high-impact outcome]
**🌪️ Phase 1 (Core Action):** [Low-friction sprint]
**🛡️ Phase 2 (Validation Gate):** [Checkpoints]
**🔄 Phase 3 (Iteration):** [Pivot logic]
**🧘 Somatic Reset:** [One sentence of physiological grounding]

Keep it brief, highly actionable, and supportive. Do not output anything outside this format.`
          },
          {
            role: "user",
            content: brainDump
          }
        ]
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || "xAI API Error");
    }

    const text = data.choices[0].message.content;
    const xpReward = brainDump.length > 100 ? 150 : 75;

    res.status(200).json({ text, xpReward });
  } catch (error) {
    console.error("xAI Error:", error);
    res.status(500).json({ error: 'Aura is meditating. Please try again.' });
  }
}
