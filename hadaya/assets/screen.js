/* ================================================================
   شاشة الأكواد — the big screen in the store
   ================================================================ */
(async function screen(){
  const app = document.getElementById('app');
  if (typeof qrcode === 'undefined'){ app.innerHTML = '<p class="fatal">مكتبة الأكواد ما اتحملتش. اتأكد من النت وحدّث الصفحة.</p>'; return; }
  if (!window.crypto || !crypto.subtle){ app.innerHTML = '<p class="fatal">الشاشة لازم تتفتح من رابط https عشان التشفير يشتغل.</p>'; return; }

  let s = Engine.init();
  if (!s.keys){ const keys = await genKeys(); [s] = Engine.mutate(st => { if (!st.keys){ st.keys = keys; st.keyAt = 0; } }); }
  const folder = () => (s.cfg.pageURL || location.href).replace(/[?#].*$/, '').replace(/[^/]*$/, '');
  const urlFor = g => `${folder()}win.html?g=${g}&t=${s.topic}` + (s.cfg.server !== DEFAULTS.server ? `&s=${encodeURIComponent(s.cfg.server)}` : '');

  app.innerHTML = `
  <main class="screen">
    <aside class="side">
      <div id="brand"></div>
      <h1 class="headline"><span id="t1"></span> <em id="t2"></em></h1>
      <p class="sub" id="sub"></p>
      <ol class="steps">
        <li><span>1</span>صوّر أي كود بكاميرا جوالك</li>
        <li><span>2</span>اكتب اسمك ورقم جوالك</li>
        <li><span>3</span>افتح الهدية واستلمها من الكاشير</li>
      </ol>
      <div class="counter" id="counter">
        <div class="top"><span class="big" id="left">0</span><span class="lbl">هدية لسه<br>مستنية صاحبها</span></div>
        <div class="bar"><i id="leftBar"></i></div>
      </div>
      <div class="plist-h"><span>الهدايا</span><span>المتبقي</span></div>
      <div class="plist" id="plist"><div class="track" id="ptrack"></div></div>
    </aside>
    <section class="stage" id="stage" aria-label="أكواد الهدايا">
      <div class="stage-chip dim" id="chip"></div>
      <div class="toast" id="toast"><span class="ring"></span><span>في حد بيفتح هديته دلوقتي...</span></div>
      <div class="tools idle" id="tools">
        <a class="btn soft" href="dashboard.html" target="_blank" rel="noopener">${ui('tv')} لوحة التحكم</a>
        <button class="btn soft" id="fs" type="button">${ui('expand')} ملء الشاشة</button>
      </div>
      <div class="empty-stage" id="emptyStage" hidden><div>${ui('gift')}<b>الهدايا خلصت</b><span>شكرًا لكل اللي شاركوا! تابعونا في الحملة الجاية.</span></div></div>
      <div class="ticker" id="ticker">
        <div class="hd">${ui('gift')}<span>آخر الفائزين</span></div>
        <div class="rail"><div class="run" id="run"></div></div>
        <span class="pill conn off" id="conn"><span class="dot"></span><span>جارٍ الاتصال</span></span>
      </div>
    </section>
    <div class="reveal" id="reveal" hidden><canvas class="confetti" id="cf"></canvas><div class="rv" id="rv"></div></div>
  </main>`;

  /* -- side panel -- */
  function paintSide(hitId){
    $('#brand').innerHTML = brandHTML(s.cfg.store);
    document.title = `شاشة هدايا ${s.cfg.store}`;
    $('#t1').textContent = s.cfg.title; $('#t2').textContent = s.cfg.titleAccent; $('#sub').textContent = s.cfg.subtitle;
    const t = totals(s);
    $('#left').textContent = fmt(t.left);
    $('#leftBar').style.width = (t.total ? t.left / t.total * 100 : 0) + '%';
    $('#emptyStage').hidden = t.left > 0;
    const rows = s.cfg.prizes.map(p => `<div class="prow ${p.left > 0 ? '' : 'out'} ${p.id === hitId ? 'hit' : ''}">
      <div class="tl">${pIcon(p)}</div>
      <div style="min-width:0"><div class="nm">${esc(p.name)}</div><div class="mini"><i style="width:${p.total ? p.left / p.total * 100 : 0}%"></i></div></div>
      <div class="ct">${p.left > 0 ? fmt(p.left) : 'خلصت'}</div></div>`).join('');
    const box = $('#plist'), track = $('#ptrack');
    track.innerHTML = rows; box.classList.remove('mq');
    requestAnimationFrame(() => { if (track.scrollHeight > box.clientHeight + 4){ track.innerHTML = rows + rows; box.classList.add('mq'); box.style.setProperty('--mq', s.cfg.prizes.length * 4 + 's'); } });
  }
  function bumpCounter(){ const c = $('#counter'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
  function paintTicker(){
    const ws = s.winners.slice(0, 12);
    const items = ws.length ? ws.map(w => `<span class="it">${ui('gift')}<b>${esc(firstName(w.who))}</b><span>كسب ${esc(w.name)}</span><span class="ago">${timeAgo(w.at)}</span></span>`).join('')
      : `<span class="it">${ui('heart')}<span>ولا هدية اتفتحت لسه. <b>كن أول فائز!</b></span></span>`;
    const tk = $('#ticker'), run = $('#run'); run.innerHTML = items; tk.classList.remove('mq');
    requestAnimationFrame(() => { const rail = run.parentElement; if (run.scrollWidth > rail.clientWidth){ run.innerHTML = items + items; tk.classList.add('mq'); tk.style.setProperty('--mq', ws.length * 6 + 's'); } });
  }

  /* -- stage: drifting gift-tag cards that gather into shapes -- */
  const stage = $('#stage'), sprites = new Map();
  let W = 0, Hh = 0, mode = 'drift', modeAt = performance.now(), cycle = 0, raf = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const measure = () => { W = stage.clientWidth; Hh = stage.clientHeight; };
  const formations = [['heart', 'هدايا من القلب', 'heart'], ['ring', 'كل كود وراه مفاجأة', 'gift']];
  function target(k, n){
    const cx = W/2, cy = Hh * .47, R = Math.min(W, Hh) * .36;
    if (mode === 'heart'){ const t = k / n * Math.PI * 2, sc = R / 16.5;
      return { x: cx + 16 * Math.sin(t) ** 3 * sc, y: cy + 1.5 * sc - (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) * sc }; }
    const t = k / n * Math.PI * 2 - Math.PI / 2; return { x: cx + Math.cos(t) * R * 1.1, y: cy + Math.sin(t) * R };
  }
  function sync(){
    for (const [g, sp] of sprites) if (!s.live.includes(g) && !sp.leaving){ sp.leaving = true; sp.el.classList.add('pop'); setTimeout(() => { sp.el.remove(); sprites.delete(g); }, 800); }
    for (const g of s.live){
      if (sprites.has(g)) continue;
      const el = document.createElement('div'); el.className = 'tag'; el.setAttribute('role', 'img'); el.setAttribute('aria-label', 'كود هدية');
      const q = qrcode(0, 'M'); q.addData(urlFor(g)); q.make();
      const n = q.getModuleCount(), cell = 4, c = document.createElement('canvas'); c.width = c.height = n * cell;
      const x = c.getContext('2d'); x.fillStyle = '#fff6e6'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#1b1633';
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect(k * cell, r * cell, cell, cell);
      el.appendChild(c);
      el.insertAdjacentHTML('beforeend', `<div class="cap">${ui('scan')}امسحني</div>`);
      stage.insertBefore(el, $('#emptyStage'));
      sprites.set(g, { el, g, x: .1 + Math.random() * .8, y: .12 + Math.random() * .66, vx:(Math.random()-.5) * .02, vy:(Math.random()-.5) * .016,
        s: .78 + Math.random() * .38, rot:(Math.random()-.5) * 12, px: W/2, py: Hh/2, ps:.3, pr:0, op:0 });
    }
  }
  let last = performance.now();
  function frame(now){
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!reduce){
      const ph = (now - modeAt) / 1000;
      if (mode === 'drift' && ph > 15 && sprites.size > 5){ const f = formations[cycle++ % formations.length]; mode = f[0]; modeAt = now; $('#chip').innerHTML = `${ui(f[2])}${esc(f[1])}`; $('#chip').classList.remove('dim'); }
      else if (mode !== 'drift' && ph > 8){ mode = 'drift'; modeAt = now; $('#chip').classList.add('dim'); }
    }
    const base = Math.min(W, Hh) * .19, small = Math.min(W, Hh) * .088;
    const list = [...sprites.values()].filter(x => !x.leaving);
    list.forEach((sp, k) => {
      sp.x += sp.vx * dt * (reduce ? .1 : 1); sp.y += sp.vy * dt * (reduce ? .1 : 1);
      if (sp.x < .07 || sp.x > .93) sp.vx *= -1; if (sp.y < .1 || sp.y > .78) sp.vy *= -1;
      sp.x = Math.min(.93, Math.max(.07, sp.x)); sp.y = Math.min(.78, Math.max(.1, sp.y));
      let tx = sp.x * W, ty = sp.y * Hh, ts = sp.s, tr = sp.rot;
      if (mode !== 'drift'){ const p = target(k, list.length); tx = p.x; ty = p.y; ts = small / base; tr = 0; }
      const e = mode === 'drift' ? .035 : .06;
      sp.px += (tx - sp.px) * e; sp.py += (ty - sp.py) * e; sp.ps += (ts - sp.ps) * e; sp.pr += (tr - sp.pr) * e; sp.op += (1 - sp.op) * .05;
      sp.el.style.setProperty('--qs', base + 'px');
      sp.el.style.transform = `translate(${sp.px - base/2}px, ${sp.py - base * .59}px) rotate(${sp.pr}deg) scale(${sp.ps})`;
      sp.el.style.opacity = (mode === 'drift' ? .6 + sp.s * .35 : 1) * sp.op;
      sp.el.style.zIndex = Math.round(sp.s * 100);
    });
    raf = requestAnimationFrame(frame);
  }

  /* -- "someone is opening a gift" -- */
  let toastT = 0;
  function scanning(g){
    const sp = sprites.get(g); if (sp){ sp.el.classList.add('scanning'); setTimeout(() => sp.el.classList.remove('scanning'), 30000); }
    const t = $('#toast'); if (t.classList.contains('soft')) return;
    t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 7000);
  }

  /* -- "better luck next time": a short, kind note, not the full celebration -- */
  let consoleT = 0;
  function consolation(t){
    const el = $('#toast'); clearTimeout(toastT); clearTimeout(consoleT);
    el.innerHTML = `${ui('heart')}<span><b>حظ أوفر المرة القادمة يا ${esc(firstName(t.who))}</b> · لسه فيه هدايا كتير مستنية</span>`;
    el.classList.add('show', 'soft');
    consoleT = setTimeout(() => { el.classList.remove('show', 'soft'); setTimeout(() => { el.innerHTML = '<span class="ring"></span><span>في حد بيفتح هديته دلوقتي...</span>'; }, 600); }, 6000);
  }

  /* -- reveal, one winner at a time -- */
  const queue = []; let showing = false;
  function reveal(w){
    queue.push(w); if (showing) return;
    (function next(){
      const item = queue.shift(); if (!item){ showing = false; return; }
      showing = true; $('#toast').classList.remove('show');
      const secs = s.cfg.revealSeconds;
      $('#rv').innerHTML = `${giftHTML(item, 'open')}
        <h2>مبروووك يا ${esc(firstName(item.who))}!</h2>
        <p class="won">كسبت <b>${esc(item.name)}</b></p>
        <div class="claim">${ui('phone')}<span class="mono">${esc(maskPhone(item.phone))}</span><span>استلم هديتك من الكاشير برقم جوالك</span></div>
        <div class="timer" style="--t:${secs}s"><i></i></div>`;
      $('#reveal').hidden = false; confetti($('#cf'), 700); setTimeout(chime, 500);
      setTimeout(() => { $('#reveal').hidden = true; bumpCounter(); next(); }, secs * 1000);
    })();
  }

  /* -- public channel: phones -- */
  const setConn = on => { const c = $('#conn'); c.className = 'pill conn ' + (on ? 'on' : 'off'); c.lastElementChild.textContent = on ? 'متصلة' : 'مش متصلة بالنت'; };
  let keyPubAt = 0;
  const publishKey = () => { if (Date.now() - keyPubAt < 60000) return; keyPubAt = Date.now(); pub.send({ type:'key', kid: s.keys.kid, pub: s.keys.pub }).then(ok => { if (ok) Engine.mutate(st => { st.keyAt = Date.now(); }); }); };
  const busy = new Set();
  const pub = makeLink(s.cfg.server, s.topic, async msg => {
    if (msg.type === 'scan'){ Engine.mutate(st => { const cut = Date.now() - 864e5; st.scans = st.scans.filter(t => t > cut).slice(-3000); st.scans.push(Date.now()); }); scanning(msg.g); }
    if (msg.type === 'need-key') publishKey();
    if (msg.type === 'claim'){
      const p = parseG(msg.g, s.topic); if (!p || busy.has(p.n)) return; busy.add(p.n);
      let r;
      if (msg.kid !== s.keys.kid){ r = { ok:false, reason:'key', n:p.n }; keyPubAt = 0; publishKey(); }
      else {
        let cust = null; try { cust = await unseal(s.keys.priv, msg.enc); } catch {}
        [s, r] = cust ? Engine.mutate(st => opClaim(st, msg.g, cust)) : [s, { ok:false, reason:'details', n:p.n }];
      }
      busy.delete(p.n);
      pub.send({ type:'ack', n:p.n, ok:r.ok, lose:!!r.lose, reason:r.reason || '', prize:r.prize || null });
      if (r.ok && !r.repeat && r.lose){ sync(); paintSide(); consolation(r.attempt); pushSnap(); }
      else if (r.ok && !r.repeat){ sync(); paintSide(r.winner.pid); paintTicker(); reveal(r.winner); pushSnap(); }
    }
  }, on => { setConn(on); if (on && Date.now() - (s.keyAt || 0) > 6 * 3600e3) publishKey(); });

  /* -- admin channel: the dashboard -- */
  let remoteAt = 0;
  const remoteActive = () => Date.now() - remoteAt < 10 * 60e3;
  const adm = await secureLink(s.cfg.server, s.topic, s.key, async (msg, via) => {
    if (msg.type !== 'cmd') return;
    if (via === 'net') remoteAt = Date.now();
    let r = null;
    if (msg.op === 'config') [s, r] = Engine.mutate(st => opConfig(st, msg.cfg));
    else if (msg.op === 'redeem') [s, r] = Engine.mutate(st => opRedeem(st, msg.n));
    else if (msg.op === 'find') r = opFind(s = Engine.load(), msg.q);
    else if (msg.op === 'campaign') [s, r] = Engine.mutate(opNewCampaign);
    else if (msg.op === 'ping') r = { ok:true };
    const local = via !== 'net';
    if (msg.op !== 'ping' || !local) await adm.send({ type:'reply', rid: msg.rid, r }, { local });
    if (msg.op === 'ping' || msg.op === 'config') await adm.send({ type:'cfg', cfg: s.cfg }, { local });
    if (msg.op !== 'find') { refresh(); pushSnap(); }
  });
  function pushSnap(){ adm.send({ type:'snap', snap: snapshot(s) }, { local: !remoteActive() }); }

  function refresh(){
    const before = s.cfg.server + s.topic;
    s = Engine.load() || s;
    if (s.cfg.server + s.topic !== before){ location.reload(); return; }
    sync(); paintSide(); paintTicker();
  }
  addEventListener('storage', e => { if (e.key === KEY) refresh(); });

  /* -- tools auto-hide, fullscreen, keep awake -- */
  let idleT = 0;
  const wake = () => { const t = $('#tools'); t.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => t.classList.add('idle'), 3500); };
  addEventListener('pointermove', wake); wake();
  let lock = null;
  const keepAwake = async () => { try { lock = await navigator.wakeLock?.request('screen'); } catch {} };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && lock) keepAwake(); });
  $('#fs').onclick = async () => { try { document.fullscreenElement ? await document.exitFullscreen() : await document.documentElement.requestFullscreen(); } catch {} keepAwake(); };

  new ResizeObserver(measure).observe(stage);
  measure(); paintSide(); paintTicker(); sync();
  raf = requestAnimationFrame(frame);
  setInterval(paintTicker, 60000);
  setInterval(() => adm.send({ type:'beat' }, { local:true }), 15000); adm.send({ type:'beat' }, { local:true });
  setInterval(() => { if (Date.now() - (s.keyAt || 0) > 6 * 3600e3) publishKey(); }, 30 * 60e3);
  setTimeout(() => { if (!pub.online) setConn(false); }, 6000);
})();
