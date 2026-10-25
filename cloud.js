/**
 * Vitverse — Cloud Sync Engine (Supabase)
 */
const CloudSync = (() => {
  // Replace these with your actual keys if you aren't using Vercel env vars
  const SUPABASE_URL = 'YOUR_SUPABASE_URL';
  const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
  
  let supabase = null;
  let currentUser = null;
  let syncTimeout = null;

  function init() {
    if (typeof supabase === 'undefined' || !window.supabase) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = () => {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        setupAuthListener();
      };
      document.head.appendChild(script);
    }
  }

  function setupAuthListener() {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        currentUser = session.user;
        await pullFromCloud();
        updateUI(true);
      } else {
        currentUser = null;
        updateUI(false);
      }
    });
  }

  async function pushToCloud() {
    if (!currentUser || !window.Companion) return;
    const state = Companion.get();
    
    const { error } = await supabase
      .from('companion_states')
      .upsert({ 
        user_id: currentUser.id, 
        state: state,
        updated_at: new Date()
      }, { onConflict: 'user_id' });

    if (error) console.error("Cloud Sync Error:", error);
  }

  async function pullFromCloud() {
    if (!currentUser) return;
    
    const { data, error } = await supabase
      .from('companion_states')
      .select('state')
      .eq('user_id', currentUser.id)
      .single();

    if (data && data.state) {
      const localState = Companion.get();
      
      // FIX: Only overwrite if the cloud state is actually newer/has more progress
      const cloudXp = data.state.xp || 0;
      const localXp = localState.xp || 0;
      const cloudLevel = data.state.level || 1;
      const localLevel = localState.level || 1;
      
      if (cloudLevel > localLevel || (cloudLevel === localLevel && cloudXp > localXp)) {
        localStorage.setItem('vitverse.companion.v4', JSON.stringify(data.state));
        if (window.Companion) {
          window.dispatchEvent(new CustomEvent('companion:update', { detail: Companion.view() }));
        }
        console.log("Newer cloud state loaded.");
      } else {
        console.log("Local state is newer. Pushing to cloud.");
        pushToCloud();
      }
    }
  }

  function queueSync() {
    if (!currentUser) return;
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(pushToCloud, 2000);
  }

  async function login(email) {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) alert(error.message);
    else alert("Check your email for the magic login link!");
  }

  async function logout() {
    await supabase.auth.signOut();
    localStorage.removeItem('vitverse.companion.v4'); 
    window.location.reload();
  }

  function updateUI(isLoggedIn) {
    const btn = document.getElementById('cloud-btn');
    if (!btn) return;
    
    if (isLoggedIn) {
      btn.innerHTML = '<i class="fa-solid fa-cloud" style="color:var(--accent)"></i>';
      btn.onclick = () => {
        if(confirm("Log out and clear local data?")) logout();
      };
    } else {
      btn.innerHTML = '<i class="fa-solid fa-cloud-slash"></i>';
      btn.onclick = () => {
        const email = prompt("Enter your email to sync across devices:");
        if (email) login(email);
      };
    }
  }

  window.addEventListener('companion:update', () => {
    queueSync();
  });

  return { init };
})();
window.CloudSync = CloudSync;