/**
 * Vitverse Companion — Real-Life RPG Engine (v3.3)
 * Added new loot items and removed halo.
 */
const Companion = (() => {
  const KEY = 'vitverse.companion.v3'; 

  const CFG = {
    version: 3,
    floors:    { calm: 30, energy: 35, rest: 40, mood: 45 },
    halfLifeH: { calm: 36, energy: 48, rest: 72, mood: 96 },
    dailyCap:  { calm: 25, energy: 20, rest: 25, mood: 15 },
    maxEvents: 200,
    maxSeen:   50,
    maxDecayH: 720,
  };

  const clamp = (v, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
  const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const urlParams = new URLSearchParams(window.location.search);
  const guildParam = urlParams.get('guild');

  const blank = () => ({
    version: CFG.version,
    vars: { calm: 60, energy: 60, rest: 60, mood: 60 },
    xp: 0, level: 1,
    inventory: { wearables: [], decor: [] },
    equipped: { wearable: null, decor: [] }, 
    guild: { code: guildParam || null, sharedStreak: 0, partnerActive: false },
    lastTick: Date.now(), day: dateKey(), gains: { calm: 0, energy: 0, rest: 0, mood: 0 },
    seen: [], events: [],
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

  // UPDATED LOOT TABLES
  const LOOT_WEARABLES = ['crown', 'scarf'];
  const LOOT_DECOR = ['plant', 'lamp', 'rug', 'gate', 'crystal', 'cat', 'tea'];

  const RULES = {
    BREATHE_COMPLETE:    { m: 'breathewell', d: p => ({ calm: ({ b478: 8, box: 6, alternateNostril: 6 })[p.protocol] ?? 5, xp: 50 }) },
    TASK_COMPLETE:       { m: 'chronozen',   d: () => ({ energy: 5, mood: 2, xp: 100, lootCheck: true }) },
    SLEEP_LOGGED:        { m: 'sleep',       d: p => {
      const h = p.hours ?? 7; const q = clamp(p.quality ?? 3, 1, 5);
      const band = (h >= 7 && h <= 9) ? 20 : (h >= 6 && h <= 10) ? 12 : 5;
      return { rest: band * (0.8 + 0.1 * (q - 1)), xp: 80 };
    } },
    MOOD_CHECKIN:        { m: 'soulsync',    d: (p, v) => ({ mood: 0.4 * (clamp(p.value, 1, 5) * 20 - v.mood), xp: 20 }) },
    REFLECTION_WRITTEN:  { m: 'reflection',  d: () => ({ mood: 3, xp: 50 }) },
    EXERCISE_LOGGED:     { m: 'exercise',    d: () => ({ energy: 8, mood: 2, xp: 75, lootCheck: true }) },
    ZEN_SESSION:         { m: 'zen',         d: () => ({ calm: 10, xp: 50 }) }, 
    EQUIP_WEARABLE:      { m: 'inventory',   d: () => ({}) }, 
    TOGGLE_DECOR:        { m: 'inventory',   d: () => ({}) }, 
    LINK_GUILD:          { m: 'guild',       d: () => ({}) },
  };

  function apply(s, event, now = Date.now()) {
    const rule = RULES[event?.type];
    if (!rule) throw new Error(`unknown event: ${event?.type}`);
    if (event.id && s.seen.includes(event.id)) return s;

    if (event.type === 'EQUIP_WEARABLE') return { ...s, equipped: { ...s.equipped, wearable: event.payload.item } };
    if (event.type === 'TOGGLE_DECOR') {
      const item = event.payload.item;
      const currentDecor = s.equipped.decor || [];
      const newDecor = currentDecor.includes(item) ? currentDecor.filter(d => d !== item) : [...currentDecor, item];
      return { ...s, equipped: { ...s.equipped, decor: newDecor } };
    }
    if (event.type === 'LINK_GUILD') return { ...s, guild: { ...s.guild, code: event.payload.code, partnerActive: true } };

    const vars = decayed(s, now);
    const raw  = rule.d(event.payload ?? {}, vars);
    const xpGain = raw.xp ?? 0;
    const hasLootCheck = raw.lootCheck ?? false;
    delete raw.xp; delete raw.lootCheck;

    const today = dateKey(new Date(now));
    const gains = today === s.day ? { ...s.gains } : { calm: 0, energy: 0, rest: 0, mood: 0 };

    for (const [k, d] of Object.entries(raw)) {
      if (!(k in vars)) continue;
      let delta = d;
      if (delta > 0) {
        const cap = CFG.dailyCap[k];
        delta = Math.min(delta * dim(gains[k], cap), cap - gains[k]);
        gains[k] = clamp(gains[k] + delta, 0, cap);
      }
      vars[k] = clamp(vars[k] + delta);
    }

    let newXp = s.xp + xpGain;
    let newLevel = s.level;
    let xpNeeded = newLevel * 1000;
    while (newXp >= xpNeeded) { newXp -= xpNeeded; newLevel++; xpNeeded = newLevel * 1000; }

    let newInventory = { ...s.inventory, wearables: [...s.inventory.wearables], decor: [...s.inventory.decor] };
    let newEquipped = { ...s.equipped };
    
    if (hasLootCheck && Math.random() < 0.4) { // Increased drop rate slightly
      const dropDecor = Math.random() < 0.7; // 70% chance for decor, 30% wearable
      if (dropDecor) {
        const avail = LOOT_DECOR.filter(i => !newInventory.decor.includes(i));
        if (avail.length > 0) newInventory.decor.push(avail[Math.floor(Math.random() * avail.length)]);
      } else {
        const avail = LOOT_WEARABLES.filter(i => !newInventory.wearables.includes(i));
        if (avail.length > 0) newInventory.wearables.push(avail[Math.floor(Math.random() * avail.length)]);
      }
    }

    return {
      ...s, vars, xp: newXp, level: newLevel, inventory: newInventory, equipped: newEquipped,
      lastTick: now, day: today, gains,
      seen:   event.id ? [...s.seen, event.id].slice(-CFG.maxSeen) : s.seen,
      events: [...s.events, { type: event.type, m: rule.m, ts: now, payload: event.payload }].slice(-CFG.maxEvents),
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
    const auraStats = [ { name: 'calm', val: v.calm }, { name: 'energy', val: v.energy }, { name: 'rest', val: v.rest }, { name: 'mood', val: v.mood } ];
    auraStats.sort((a, b) => b.val - a.val); 

    return {
      vars: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Math.round(x)])),
      xp: s.xp, level: s.level, xpNeeded: s.level * 1000,
      inventory: s.inventory, equipped: s.equipped, guild: s.guild,
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
  
  const save = s => localStorage.setItem(KEY, JSON.stringify(s));
  const fire = s => window.dispatchEvent(new CustomEvent('companion:update', { detail: view(s) }));

  return {
    get: () => load(), view: (now) => view(load(), now),
    emit(event) { const next = apply(load(), event); save(next); fire(next); return view(next); },
    reset() { localStorage.removeItem(KEY); fire(blank()); },
    subscribe(fn) { window.addEventListener('companion:update', e => fn(e.detail)); },
  };
})();
window.Companion = Companion;
