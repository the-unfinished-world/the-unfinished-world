// Members: sign in with Google, then a small profile (name, work, interests, bio, picture, listed or not).
// The People view replaces the left column; it opens from the walker in the scene or from #people.
// All data goes through Supabase functions: my_profile, save_profile, people (see supabase/*.sql).
(function () {
  const URL_ = 'https://pzzivuxhfpaiucbfqypw.supabase.co';
  const KEY = 'sb_publishable_wDp2THeQsaJSkjkUwMRbJw_A-OmMO8e';                       // publishable key: safe in the browser by design
  const PROVIDERS = [['google', 'Google']];
  const $ = id => document.getElementById(id);
  const dlg = $('joinDialog'), form = $('profileForm'), status = $('joinStatus'), signin = $('signinBox'), oauth = $('joinOauth');
  const title = $('joinTitle'), who = $('whoami'), preview = $('picPreview'), fileIn = $('picUpload'), usePhoto = $('usePhoto');
  const about = $('about'), peopleBox = $('people'), peopleList = $('peopleList');
  const F = form.elements;
  let sb = null, session = null, providerPhoto = null, avatarUrl = null;

  const say = (t, kind) => { status.textContent = t || ''; status.dataset.kind = kind || ''; };
  const openDialog = () => { if (!dlg.open) dlg.showModal(); };
  document.querySelectorAll('[data-join]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); openDialog(); }));
  $('joinClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  // ---------- pictures: an ink figure (male / female walker, standing) or a photo ----------
  function figureCanvas(variant, w, h) {
    const c = document.createElement('canvas'), r = Math.min(devicePixelRatio || 1, 2);
    c.width = w * r; c.height = h * r; c.style.width = w + 'px'; c.style.height = h + 'px'; c.className = 'pic';
    const g = c.getContext('2d'); g.scale(r, r); g.fillStyle = '#f1ede4'; g.fillRect(0, 0, w, h);
    const v = variant === 'female' ? 'female' : 'male', body = window.TUWBodies && (TUWBodies.byId(variant) || TUWBodies.byId(v));
    if (window.drawWalkerBrush && window.TUWRig && body) {   // the same rig and bodies as the walker in the scene, standing
      const pose = TUWRig.pose({ idle: 1 });
      drawWalkerBrush(g, { x: w / 2, y: h - 3, h: h * .9, phase: 0, alpha: 1, color: '#1c1a17', draw: (c, o) => drawBody(c, body, pose, { x: o.x, y: o.y, h: o.h, dir: 1, color: o.color }) });
    } else if (window.drawWalkerBrush) drawWalkerBrush(g, { x: w / 2, y: h - 3, h: h * .9, phase: 0, idle: 1, yaw: 1, slope: 0, alpha: 1, color: '#1c1a17', variant: v });
    return c;
  }
  function picture(p, w, h) {
    if (p.avatar_kind === 'photo' && p.avatar_url) {
      const img = new Image(); img.className = 'pic photo'; img.alt = ''; img.width = w; img.height = h; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
      img.src = p.avatar_url; img.onerror = () => img.replaceWith(figureCanvas(p.figure, w, h)); return img;
    }
    return figureCanvas(p.figure, w, h);
  }
  // the character picker lists every body in bodies.js (archetypes first)
  if (window.TUWBodies) {
    F.figure.replaceChildren();
    for (const [label, set] of [['Archetypes', TUWBodies.archetypes], ['Everyday', TUWBodies.variants]]) {
      const g = document.createElement('optgroup'); g.label = label;
      for (const b of set) { const op = document.createElement('option'); op.value = b.id; op.textContent = b.label; g.appendChild(op); }
      F.figure.appendChild(g);
    }
  }
  const charId = id => (window.TUWBodies && TUWBodies.byId(id) ? TUWBodies.byId(id).id : 'walker');
  const setCharacter = id => { window.tuwCharacter = id || null; };
  function refreshPreview() {
    const kind = F.avatar_kind.value;
    preview.replaceChildren(picture({ avatar_kind: kind, figure: F.figure.value, avatar_url: avatarUrl }, 56, 64));
    usePhoto.hidden = !providerPhoto;
  }
  form.addEventListener('change', e => { if (e.target.name === 'avatar_kind' || e.target.name === 'figure') refreshPreview(); if (e.target.name === 'figure') setCharacter(F.figure.value); });
  usePhoto.addEventListener('click', () => { avatarUrl = providerPhoto; F.avatar_kind.value = 'photo'; refreshPreview(); });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files && fileIn.files[0]; if (!f || !session) return;
    try {
      say('Uploading…');
      const bmp = await createImageBitmap(f), s = Math.min(1, 480 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .86));
      const path = session.user.id + '/avatar.jpg';
      const { error } = await sb.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      if (error) throw error;
      avatarUrl = URL_ + '/storage/v1/object/public/avatars/' + path + '?v=' + Date.now();
      F.avatar_kind.value = 'photo'; refreshPreview(); say('Photo ready. Save to keep it.');
    } catch (err) { say('That picture could not be uploaded. Try a JPEG or PNG under 2 MB.', 'err'); }
    fileIn.value = '';
  });

  // ---------- signed-out / signed-in states ----------
  function showSignedOut() {
    session = null; setCharacter(null); title.textContent = 'Join the Collective';
    signin.hidden = false; form.hidden = true; say('');
    document.querySelectorAll('.join[data-join]').forEach(b => b.textContent = 'Join the Collective');
  }
  async function showSignedIn(s) {
    session = s; const u = s.user, m = u.user_metadata || {};
    providerPhoto = m.avatar_url || m.picture || null;
    signin.hidden = true; form.hidden = false;
    who.textContent = 'Signed in' + (u.email ? ' as ' + u.email : '') + '.';
    const { data } = await sb.rpc('my_profile');
    const p = data && data[0];
    F.name.value = (p && p.name) || m.full_name || m.name || m.user_name || '';
    F.work.value = (p && p.work) || ''; F.interests.value = (p && p.interests) || ''; F.bio.value = (p && p.bio) || '';
    F.figure.value = charId(p && p.figure); F.avatar_kind.value = (p && p.avatar_kind) || 'figure';
    setCharacter(p ? F.figure.value : null);   // a member walks the bridges as their chosen character
    avatarUrl = (p && p.avatar_url) || null; F.listed.checked = !!(p && p.listed);
    title.textContent = p ? 'Your profile' : 'Join the Collective';
    $('saveBtn').textContent = p ? 'Save' : 'Join';
    document.querySelectorAll('.join[data-join]').forEach(b => b.textContent = p ? 'Your profile' : 'Join the Collective');
    refreshPreview(); say('');
  }

  form.addEventListener('submit', async e => {
    e.preventDefault(); if (!form.reportValidity() || !session) return;
    const btn = $('saveBtn'); btn.disabled = true; say('Saving…');
    const args = { p_name: F.name.value.trim(), p_work: F.work.value.trim() || null, p_bio: F.bio.value.trim() || null, p_interests: F.interests.value.trim() || null,
      p_avatar_kind: F.avatar_kind.value, p_figure: F.figure.value, p_avatar_url: F.avatar_kind.value === 'photo' ? avatarUrl : null, p_listed: F.listed.checked };
    let { data, error } = await sb.rpc('save_profile', args);
    // until supabase/003_characters.sql is applied the database only accepts 'male' / 'female': save the plain walker
    // of the same base instead, and keep the chosen character for this visit
    if (error && error.code === '23514' && !['male', 'female'].includes(args.p_figure)) {
      const b = window.TUWBodies && TUWBodies.byId(args.p_figure);
      ({ data, error } = await sb.rpc('save_profile', Object.assign({}, args, { p_figure: b && b.base === 'female' ? 'female' : 'male' })));
    }
    btn.disabled = false;
    if (error) { say(error.message && error.message.length < 120 ? error.message : 'Something went wrong. Please try again.', 'err'); return; }
    say(data === 'joined' ? 'Welcome to the collective.' : 'Saved.', 'ok'); setCharacter(F.figure.value);
    title.textContent = 'Your profile'; btn.textContent = 'Save';
    document.querySelectorAll('.join[data-join]').forEach(b => b.textContent = 'Your profile');
    if (!peopleBox.hidden) loadPeople();
  });
  $('signOut').addEventListener('click', async () => { await sb.auth.signOut(); showSignedOut(); });

  // ---------- the People view ----------
  async function loadPeople() {
    peopleList.replaceChildren(); $('peopleEmpty').hidden = true;
    let rows = [];
    try { const r = await fetch(URL_ + '/rest/v1/rpc/people', { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: '{}' }); if (r.ok) rows = await r.json(); } catch (e) {}
    $('peopleEmpty').hidden = rows.length > 0;
    for (const p of rows) {
      const li = document.createElement('li'); li.className = 'person'; li.tabIndex = 0;
      const txt = document.createElement('div'); txt.className = 'who';
      const n = document.createElement('div'); n.textContent = p.name;
      const w = document.createElement('div'); w.className = 'work'; w.textContent = p.work || '';
      const more = document.createElement('div'); more.className = 'more';
      if (p.interests) { const i = document.createElement('div'); i.className = 'work'; i.textContent = p.interests; more.appendChild(i); }
      if (p.bio) { const b = document.createElement('div'); b.textContent = p.bio; more.appendChild(b); }
      txt.append(n, w, more); li.append(picture(p, 56, 64), txt);
      if (more.childNodes.length) { const t = () => li.classList.toggle('open'); li.addEventListener('click', t); li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t(); } }); }
      else li.classList.add('plain');
      peopleList.appendChild(li);
    }
  }
  function route() {
    const people = location.hash === '#people';
    about.hidden = people; peopleBox.hidden = !people;
    if (people) { loadPeople(); window.scrollTo(0, 0); }
    if (location.hash === '#join') openDialog();
  }
  addEventListener('hashchange', route);
  // the walker in the scene is the door to the People view (its screen box is published each frame by the scene)
  const cv = document.getElementById('c');
  const onWalker = e => { const b = window.walkerBox; if (!b) return false; const pad = 16; return e.clientX > b.x0 - pad && e.clientX < b.x1 + pad && e.clientY > b.y0 - pad && e.clientY < b.y1 + pad; };
  cv.addEventListener('mousemove', e => { const on = onWalker(e); cv.style.cursor = on ? 'pointer' : ''; cv.title = on ? 'The people' : ''; });
  cv.addEventListener('click', e => { if (onWalker(e)) location.hash = location.hash === '#people' ? '' : '#people'; });

  // ---------- start ----------
  if (!window.supabase) { $('signinNote').textContent = 'Sign-in could not load. Please try again later.'; route(); return; }
  sb = window.supabase.createClient(URL_, KEY, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } });
  fetch(URL_ + '/auth/v1/settings', { headers: { apikey: KEY } }).then(r => r.json()).then(s => {
    const on = PROVIDERS.filter(([id]) => s.external && s.external[id]);
    for (const [id, label] of on) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'oauth'; b.textContent = 'Continue with ' + label;
      b.addEventListener('click', () => { $('signinNote').textContent = 'Opening ' + label + '…'; sb.auth.signInWithOAuth({ provider: id, options: { redirectTo: location.origin + location.pathname + '#join' } }); });
      oauth.appendChild(b);
    }
    if (!on.length) $('signinNote').textContent = 'Sign-in opens soon.';
  }).catch(() => { $('signinNote').textContent = 'Sign-in could not load. Please try again later.'; });
  const back = /[?&]code=/.test(location.search);
  sb.auth.onAuthStateChange((ev, s) => { if (ev === 'SIGNED_OUT') showSignedOut(); else if (s && (!session || s.user.id !== session.user.id)) showSignedIn(s); });
  sb.auth.getSession().then(({ data }) => {
    if (data.session) showSignedIn(data.session); else showSignedOut();
    if (back) { history.replaceState(null, '', location.pathname + '#join'); openDialog(); }
    route();
  });
  window.tuwMembers = { client: () => sb };
})();
