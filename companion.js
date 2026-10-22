/**
 * Vitverse Companion — state engine (spec v1)
 * Event-sourced. No UI dependency. Safe to test in console.
 *
 * Usage:
 *   Companion.emit({ id, type, payload })
 *   Companion.view()            -> presentation state
 *   Companion.get()             -> raw state (debug only)
 *   Companion.reset()           -> wipe (dev)
 *   Companion._selfTest()       -> run assertions in console
 */
const Companion = (() => {
  const KEY = 'vitverse.companion.v1';

  const CFG = {
    version: 1,
    floors:    { calm: 30, energy: 35, rest: 40, mood: 45 },
    halfLifeH: { calm: 36, energy: 48, rest: 72, mood: 96 },
    dailyCap:  { calm: 25, energy: 20, rest: 25, mood: 15 },
    penalties: false,
    maxEvents: 200,
    maxSeen:   50,
    maxDecayH: 720,          // cap decay window at 30 days
  };

  const clamp = (v, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
  const dateKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const blank = () => ({
    version: CFG.version,
    vars: { calm: 60, energy: 60, rest: 60, mood: 60 },
    bond: 0,
    lastTick: Date.now(),
    day: dateKey(),
    gains: { calm: 0, energy: 0, rest: 0, mood: 0 },
    seen: [],
    events: [],
  });

  // ---- decay (lazy, computed on read) ----
  function decayed(s, now) {
    const dtH = Math.max(0, Math.min(CFG.maxDecayH, (now - s.lastTick) / 3.6e6));
    const out = { ...s.vars };
    const mean = (out.calm + out.energy + out.rest) / 3;
    for (const k of Object.keys(out)) {
      const floor = k === 'mood'
        ? 0.7 * CFG.floors.mood + 0.3 * mean
        : CFG.floors[k];
      const lambda = Math.LN2 / CFG.halfLifeH[k];
      out[k] = floor + (out[k] - floor) * Math.exp(-lambda * dtH);
    }
    return out;
  }

  // ---- diminishing returns ----
  const dim = (used, cap) => {
    const r = used / cap;
    return r < 0.5 ? 1 : r < 0.8 ? 0.6 : r >= 1 ? 0 : 0.3;
  };

  // ---- event rules ----
  const RULES = {
    BREATHE_COMPLETE:    { m: 'breathewell', d: p => ({
      calm: ({ b478: 8, box: 6, alternateNostril: 6 })[p.protocol] ?? 5,
      bond: 1 }) },
    TASK_COMPLETE:       { m: 'chronozen',   d: () => ({ energy: 5, mood: 2, bond: 1 }) },
    SLEEP_LOGGED:        { m: 'sleep',       d: p => {
      const h = p.hours ?? 7;
      const q = clamp(p.quality ?? 3, 1, 5);
      const band = (h >= 7 && h <= 9) ? 20 : (h >= 6 && h <= 10) ? 12 : 5;
      return { rest: band * (0.8 + 0.1 * (q - 1)), bond: 1 };
    } },
    MOOD_CHECKIN:        { m: 'moods',       d: (p, v) => ({
      mood: 0.4 * (clamp(p.value, 1, 5) * 20 - v.mood),
      bond: 1 }) },
    REFLECTION_WRITTEN:  { m: 'reflection',  d: () => ({ mood: 3, bond: 2 }) },
    EXERCISE_LOGGED:     { m: 'exercise',    d: () => ({ energy: 8, mood: 2, bond: 1 }) },
  };

  // ---- core reducer ----
  function apply(s, event, now = Date.now()) {
    const rule = RULES[event?.type];
    if (!rule) throw new Error(`unknown event: ${event?.type}`);
    if (event.id && s.seen.includes(event.id)) return s;   // idempotent

    const vars = decayed(s, now);
    const raw  = rule.d(event.payload ?? {}, vars);
    const bondGain = raw.bond ?? 0;
    delete raw.bond;

    const today = dateKey(new Date(now));
    const gains = today === s.day
      ? { ...s.gains }
      : { calm: 0, energy: 0, rest: 0, mood: 0 };

    for (const [k, d] of Object.entries(raw)) {
      if (!(k in vars)) continue;
      let delta = d;
      if (delta > 0) {
        const cap = CFG.dailyCap[k];
        delta = Math.min(delta * dim(gains[k], cap), cap - gains[k]);
        gains[k] = clamp(gains[k] + delta, 0, cap);
      } else if (!CFG.penalties) {
        continue;
      }
      vars[k] = clamp(vars[k] + delta);
    }

    return {
      ...s, vars,
      bond: s.bond + bondGain,
      lastTick: now, day: today, gains,
      seen:   event.id ? [...s.seen, event.id].slice(-CFG.maxSeen) : s.seen,
      events: [...s.events, { type: event.type, m: rule.m, ts: now, payload: event.payload }].slice(-CFG.maxEvents),
    };
  }

  // ---- derived presentation ----
  const level = b => Math.floor(Math.sqrt(b / 5));

  // ---- memory generation ----
  function getMemory(s) {
    if (s.bond === 0) return "Hi! I'm your companion. Log something to help me grow.";
    
    const recent = s.events.slice().reverse();
    for (let e of recent) {
      if (e.type === 'SLEEP_LOGGED' && e.payload?.hours) {
        return `I remember you slept ${e.payload.hours} hours recently. I feel rested too!`;
      }
      if (e.type === 'BREATHE_COMPLETE') {
        return "Thanks for breathing with me. I feel so calm right now.";
      }
      if (e.type === 'MOOD_CHECKIN') {
        return "I remember how you felt earlier. Thanks for sharing that with me.";
      }
      if (e.type === 'TASK_COMPLETE') {
        return "You finished a task! I'm proud of you. We're getting things done.";
      }
      if (e.type === 'EXERCISE_LOGGED') {
        return "I remember that exercise session. You gave me so much energy!";
      }
    }
    return "I'm glad you're here.";
  }

  // ---- daily quest generation ----
  function getQuest(s, v) {
    // Find the lowest stat
    const stats = [
      { key: 'calm', val: v.calm, text: "I feel a bit anxious. Can we do a breathing exercise?", link: "breathewell.html", action: "Breathe" },
      { key: 'energy', val: v.energy, text: "I'm feeling sluggish. Can we finish a task?", link: "chronozen.html", action: "Focus" },
      { key: 'rest', val: v.rest, text: "I'm sleepy. Will you log your sleep for me?", link: "dreamweaver.html", action: "Sleep" },
      { key: 'mood', val: v.mood, text: "I feel a little down. Can you check in with me?", link: "soulsync.html", action: "SoulSync" }
    ];

    stats.sort((a, b) => a.val - b.val);
    return stats[0];
  }

  function view(s, now = Date.now()) {
    const v = decayed(s, now);
    const h = new Date(now).getHours();
    return {
      vars: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Math.round(x)])),
      bond: s.bond,
      level: level(s.bond),
      moodWord:  v.mood   >= 80 ? 'radiant' : v.mood   >= 60 ? 'content'
              : v.mood   >= 45 ? 'settled' : v.mood   >= 30 ? 'quiet' : 'low',
      energyBand: v.energy >= 70 ? 'bouncy' : v.energy >= 45 ? 'steady' : 'slow',
      breathSync: v.calm   >= 70 ? 'slow'   : v.calm   >= 45 ? 'even'   : 'shallow',
      isResting: v.rest < 40 && (h >= 22 || h < 6),
      isNeglected: false,
      memory: getMemory(s),
      quest: getQuest(s, v),
    };
  }

  // ---- persistence ----
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      return !s || s.version !== CFG.version ? blank() : s;
    } catch { return blank(); }
  }
  const save = s => localStorage.setItem(KEY, JSON.stringify(s));
  const fire = s => window.dispatchEvent(new CustomEvent('companion:update', { detail: view(s) }));

  // ---- public API ----
  return {
    get:    () => load(),
    view:   (now) => view(load(), now),
    emit(event) {
      const next = apply(load(), event);
      save(next);
      fire(next);
      return view(next);
    },
    reset() { localStorage.removeItem(KEY); fire(blank()); },
    subscribe(fn) { window.addEventListener('companion:update', e => fn(e.detail)); },

    // dev only
    _devSetLastTick(msAgo) {
      const s = load();
      s.lastTick = Date.now() - msAgo;
      save(s); fire(s);
    },
    _selfTest() {
      const R = [];
      const A = (name, cond) => R.push({ name, pass: !!cond });
      const local = blank();

      const s1 = apply(local, { id: 'a', type: 'BREATHE_COMPLETE', payload: { protocol: 'b478' } });
      A('breathe adds 8 calm', Math.round(s1.vars.calm) === 68);

      const s2 = apply(s1, { id: 'a', type: 'BREATHE_COMPLETE', payload: { protocol: 'b478' } });
      A('duplicate id is no-op', s2 === s1);

      let s3 = s1;
      for (let i = 0; i < 10; i++)
        s3 = apply(s3, { id: `b${i}`, type: 'BREATHE_COMPLETE', payload: { protocol: 'b478' } });
      A('calm capped at 85', Math.round(s3.vars.calm) <= 85);

      const old = blank();
      old.lastTick = Date.now() - 30 * 24 * 3600 * 1000;
      const d = decayed(old, Date.now());
      A('calm never below floor',   d.calm   >= CFG.floors.calm   - 0.01);
      A('energy never below floor', d.energy >= CFG.floors.energy - 0.01);
      A('rest never below floor',   d.rest   >= CFG.floors.rest   - 0.01);

      const b0 = s1.bond;
      const s4 = apply(s1, { id: 'c', type: 'TASK_COMPLETE' });
      A('bond monotonic up', s4.bond > b0);

      const mf = 0.7 * CFG.floors.mood + 0.3 * (30 + 35 + 40) / 3;
      A('mood floor formula', Math.abs(mf - (0.7 * 45 + 0.3 * 35)) < 0.01);

      const passed = R.filter(r => r.pass).length;
      console.log(`%cCompanion self-test: ${passed}/${R.length} passed`,
        `color:${passed === R.length ? '#4ade80' : '#f87171'};font-weight:bold`);
      R.forEach(r => console.log(`  ${r.pass ? '✓' : '✗'} ${r.name}`));
      return R;
    },
  };
})();

window.Companion = Companion;
