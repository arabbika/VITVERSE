/**
 * Vitverse Companion — Real-Life RPG Engine (v4.1)
 * Bulletproofed: Handles missing/corrupt data gracefully.
 */
const Companion = (() => {
  const KEY = 'vitverse.companion.v4'; // UPGRADED TO V4 TO CLEAR OLD DATA

  const CFG = {
    version: 4,
    floors:    { calm: 30, energy: 35, rest: 40, mood: 45 },
    halfLifeH: { calm: 36, energy: 48, rest: 72, mood: 96 },
    dailyCap:  { calm: 25, energy: 20, rest: 25, mood: 15 },
    maxEvents: 200, 
    maxSeen: 50, 
    maxDecayH: 720,
  };

  const clamp = (v, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
  const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const blank = () => ({
    version: CFG.version,
    vars: { calm: 60, energy: 60, rest: 60, mood: 60 },
    xp: 0, 
    level: 1,
    lastTick: Date.now(), 
    day: dateKey(), 
    gains: { calm: 0, energy: 0, rest: 0, mood: 0 },
    seen: [], 
    events: [],
  });

  function decayed(s, now) {
    const dtH = Math.max(0, Math.min(CFG.maxDecayH, (now - s.lastTick) / 3.6e6));
    const out = { ...s.vars };
    const mean = (out.calm + out.energy + out.rest) / 3;
    
    for (const k of Object.keys(out)) {
      const floor = k === 'mood' ? 0.7 * CFG.floors.mood + 0.3 * mean : CFG.floors[k];
      const lambda = Math.LN2 / CFG.halfLifeH[k];
      out[k] = floor + (out[k] - floor) * Math.exp(-lambda * dtH);
    }
    return out;
  }

  const dim = (used, cap) => {
    const r = used / cap;
    return r < 0.5 ? 1 : r < 0.8 ? 0.6 : r >= 1 ? 0 : 0.3;
  };

  const RULES = {
    BREATHE_COMPLETE:    { m: 'breathewell', d: p => ({ 
      calm: ({ b478: 8, box: 6, alternateNostril: 6 })[p.protocol] ?? 5, xp: 50 }) },
    TASK_COMPLETE:       { m: 'chronozen',   d: () => ({ 
      energy: 5, mood: 2, xp: 100 }) },
    SLEEP_LOGGED:        { m: 'sleep',       d: p => {
      const h = p.hours ?? 7; 
      const q = clamp(p.quality ?? 3, 1, 5);
      const band = (h >= 7 && h <= 9) ? 20 : (h >= 6 && h <= 10) ? 12 : 5;
      return { rest: band * (0.8 + 0.1 * (q - 1)), xp: 80 };
    } },
    MOOD_CHECKIN:        { m: 'soulsync',    d: (p, v) => ({ 
      mood: 0.4 * (clamp(p.value, 1, 5) * 20 - v.mood), xp: 20 }) },
    REFLECTION_WRITTEN:  { m: 'reflection',  d: () => ({ 
      mood: 3, xp: 50 }) },
    EXERCISE_LOGGED:     { m: 'exercise',    d: () => ({ 
      energy: 8, mood: 2, xp: 75 }) },
    ZEN_SESSION:         { m: 'zen',         d: () => ({ 
      calm: 10, xp: 50 }) }, 
  };

  function apply(s, event, now = Date.now()) {
    const rule = RULES[event?.type];
    if (!rule) throw new Error(`unknown event: ${event?.type}`);
    if (event.id && s.seen?.includes(event.id)) return s;

    const vars = decayed(s, now);
    const raw  = rule.d(event.payload ?? {}, vars);
    const xpGain = raw.xp ?? 0;
    delete raw.xp;

    const today = dateKey(new Date(now));
    const gains = today === s.day ? { ...(s.gains || { calm: 0, energy: 0, rest: 0, mood: 0 }) } : { calm: 0, energy: 0, rest: 0, mood: 0 };

    for (const [k, d] of Object.entries(raw)) {
      if (!(k in vars)) continue;
      let delta = d;
      if (delta > 0) {
        const cap = CFG.dailyCap[k];
        delta = Math.min(delta * dim(gains[k] || 0, cap), cap - (gains[k] || 0));
        gains[k] = clamp((gains[k] || 0) + delta, 0, cap);
      }
      vars[k] = clamp(vars[k] + delta);
    }

    // FIX: Fallbacks for missing xp/level
    let newXp = (s.xp ?? 0) + xpGain;
    let newLevel = s.level ?? 1;
    let xpNeeded = newLevel * 1000;
    
    while (newXp >= xpNeeded) { 
      newXp -= xpNeeded; 
      newLevel++; 
      xpNeeded = newLevel * 1000; 
    }

    return {
      ...s, vars, xp: newXp, level: newLevel,
      lastTick: now, day: today, gains,
      seen:   event.id ? [...(s.seen || []), event.id].slice(-CFG.maxSeen) : (s.seen || []),
      events: [...(s.events || []), { type: event.type, m: rule.m, ts: now, payload: event.payload }].slice(-CFG.maxEvents),
    };
  }

  function getQuest(v) {
    const stats = [
      { key: 'calm', val: v.calm, text: "The winds of chaos are rising. We must restore Focus.", link: "breathewell.html", action: "Cast Focus" },
      { key: 'energy', val: v.energy, text: "The village requires action. We must complete a Quest.", link: "chronozen.html", action: "Enter Chronozen" },
      { key: 'rest', val: v.rest, text: "Our vitality is fading. We must Rest at Camp.", link: "dreamweaver.html", action: "Rest at Camp" },
      { key: 'mood', val: v.mood, text: "The spirit is heavy. We must commune with SoulSync.", link: "soulsync.html", action: "Commune" }
    ];
    stats.sort((a, b) => a.val - b.val);
    return stats[0];
  }

  function view(s, now = Date.now()) {
    const v = decayed(s, now);
    const h = new Date(now).getHours();
    
    const auraStats = [ 
      { name: 'calm', val: v.calm }, 
      { name: 'energy', val: v.energy }, 
      { name: 'rest', val: v.rest }, 
      { name: 'mood', val: v.mood } 
    ];
    auraStats.sort((a, b) => b.val - a.val); 

    return {
      vars: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Math.round(x)])),
      xp: s.xp ?? 0, 
      level: s.level ?? 1, 
      xpNeeded: (s.level ?? 1) * 1000,
      dominantStat: auraStats[0].name,
      moodWord:  v.mood >= 80 ? 'radiant' : v.mood >= 60 ? 'content' : v.mood >= 45 ? 'settled' : v.mood >= 30 ? 'quiet' : 'low',
      energyBand: v.energy >= 70 ? 'bouncy' : v.energy >= 45 ? 'steady' : 'slow',
      breathSync: v.calm >= 70 ? 'slow' : v.calm >= 45 ? 'even' : 'shallow',
      isResting: v.rest < 40 && (h >= 22 || h < 6),
      quest: getQuest(v),
    };
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      return !s || s.version !== CFG.version ? blank() : s;
    } catch { return blank(); }
  }
  
  const save = s => {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } 
    catch (e) { console.error("Failed to save state", e); }
  };
  
  const fire = s => window.dispatchEvent(new CustomEvent('companion:update', { detail: view(s) }));

  return {
    get: () => load(), 
    view: (now) => view(load(), now),
    emit(event) { 
      const next = apply(load(), event); 
      save(next); 
      fire(next); 
      return view(next); 
    },
    reset() { 
      localStorage.removeItem(KEY); 
      fire(blank()); 
    },
    subscribe(fn) { 
      window.addEventListener('companion:update', e => fn(e.detail)); 
    },
  };
})();

window.Companion = Companion;
