// Join the Collective: a small dialog that writes to Supabase through one function (join_collective).
// Sign-in buttons appear only for providers switched on in the Supabase project, so the form works on its own.
(function () {
  const URL_ = 'https://pzzivuxhfpaiucbfqypw.supabase.co';
  const KEY = 'sb_publishable_wDp2THeQsaJSkjkUwMRbJw_A-OmMO8e';            // publishable key: safe in the browser by design
  const PROVIDERS = [['google', 'Google'], ['twitter', 'X'], ['github', 'GitHub'], ['linkedin_oidc', 'LinkedIn']];
  const dlg = document.getElementById('joinDialog'), form = document.getElementById('joinForm');
  const status = document.getElementById('joinStatus'), oauth = document.getElementById('joinOauth'), or = document.getElementById('joinOr');
  const fName = form.elements.name, fEmail = form.elements.email, fBio = form.elements.bio, submit = form.querySelector('button[type=submit]');
  let sb = null, session = null;
  const say = (t, kind) => { status.textContent = t || ''; status.dataset.kind = kind || ''; };
  const open = () => { if (!dlg.open) dlg.showModal(); (fName.value ? fBio : fName).focus(); };

  document.querySelectorAll('[data-join]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); open(); }));
  document.getElementById('joinClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });     // click on the backdrop
  if (location.hash === '#join') open();

  if (window.supabase) {
    sb = window.supabase.createClient(URL_, KEY, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } });
    // show only the sign-in providers that are enabled in the project
    fetch(URL_ + '/auth/v1/settings', { headers: { apikey: KEY } }).then(r => r.json()).then(s => {
      const on = PROVIDERS.filter(([id]) => s.external && s.external[id]);
      for (const [id, label] of on) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'oauth'; b.textContent = 'Continue with ' + label;
        b.addEventListener('click', () => { say('Opening ' + label + '…'); sb.auth.signInWithOAuth({ provider: id, options: { redirectTo: location.origin + location.pathname + '#join' } }); });
        oauth.appendChild(b);
      }
      oauth.hidden = or.hidden = on.length === 0 || !!session;
    }).catch(() => {});
    sb.auth.getSession().then(({ data }) => {
      session = data.session; if (!session) return;
      const u = session.user, m = u.user_metadata || {};
      fName.value = fName.value || m.full_name || m.name || m.user_name || '';
      if (u.email) { fEmail.value = u.email; fEmail.readOnly = true; }
      oauth.hidden = or.hidden = true;
      sb.rpc('my_membership').then(({ data: rows }) => {
        const r = rows && rows[0];
        if (r) { fName.value = r.name; if (r.bio) fBio.value = r.bio; submit.textContent = 'Save'; say('You are already a member. You can update your note here.'); }
        else say('Signed in' + (u.email ? ' as ' + u.email : '') + '. Add a few words and join.');
      });
      if (/[?&]code=/.test(location.search)) history.replaceState(null, '', location.pathname + '#join');
      open();
    });
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    submit.disabled = true; say('Sending…');
    const args = { p_name: fName.value.trim(), p_email: fEmail.value.trim(), p_bio: fBio.value.trim() || null };
    try {
      let res;
      if (sb) { const { data, error } = await sb.rpc('join_collective', args); if (error) throw error; res = data; }
      else {
        const r = await fetch(URL_ + '/rest/v1/rpc/join_collective', { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
        res = await r.json(); if (!r.ok) throw res;
      }
      if (res === 'already') say('You are already on the list. We will be in touch.', 'ok');
      else if (res === 'updated') say('Saved. Thank you.', 'ok');
      else { say('Welcome to the collective. We will be in touch soon.', 'ok'); form.classList.add('done'); }
    } catch (err) {
      say((err && err.message) || 'Something went wrong. Please try again.', 'err');
    } finally { submit.disabled = false; }
  });
})();
