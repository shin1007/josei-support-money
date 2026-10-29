// 公開サイト共通の操作（publish.py が各ページに読み込ませる）
(async () => {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.sitenav a').forEach(a => { if (a.getAttribute('href') === page || (page === 'report.html' && a.getAttribute('href') === 'index.html')) a.classList.add('on'); });

  // ---- 人物・団体名にホバー表示とリンクを付ける ----
  let reg = { people: {}, orgs: {} };
  try { reg = await (await fetch('assets/registry.json')).json(); } catch (e) {}
  const ents = [];
  for (const [k, v] of Object.entries(reg.people)) if (k.length >= 3) ents.push([k, 'people', v]);
  for (const [k, v] of Object.entries(reg.orgs)) if (k.length >= 3) ents.push([k, 'orgs', v]);
  ents.sort((a, b) => b[0].length - a[0].length);
  const byName = new Map(ents.map(e => [e[0], e]));
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = ents.length ? new RegExp(ents.map(e => esc(e[0])).join('|'), 'g') : null;
  const SKIP = new Set(['A', 'SCRIPT', 'STYLE', 'SVG', 'TEXT', 'INPUT', 'TEXTAREA', 'BUTTON', 'H1', 'TITLE', 'NAV', 'CODE']);
  const selfId = decodeURIComponent(location.hash.slice(1));
  let wraps = 0;
  function walk(node) {
    if (node.nodeType === 1) {
      if (SKIP.has(node.tagName.toUpperCase()) || node.closest('svg,.sitenav,#tip')) return;
      [...node.childNodes].forEach(walk);
    } else if (node.nodeType === 3 && rx && wraps < 6000) {
      const t = node.nodeValue; rx.lastIndex = 0;
      if (!rx.test(t)) return;
      rx.lastIndex = 0;
      const frag = document.createDocumentFragment(); let last = 0, m;
      while ((m = rx.exec(t))) {
        const e = byName.get(m[0]);
        const card = node.parentElement && node.parentElement.closest('.card');
        if (card && card.id === m[0]) continue; // 自分自身のカード内はリンクしない
        frag.append(t.slice(last, m.index));
        const a = document.createElement('a');
        a.className = 'ent'; a.textContent = m[0]; a.dataset.kind = e[1];
        a.href = `${e[1]}.html#${encodeURIComponent(m[0])}`;
        frag.append(a); last = m.index + m[0].length; wraps++;
      }
      if (last) { frag.append(t.slice(last)); node.replaceWith(frag); }
    }
  }
  walk(document.querySelector('main') || document.body);

  const tip = document.createElement('div'); tip.id = 'tip'; document.body.append(tip);
  const row = (k, v) => v ? `<div><span class="k">${k}</span>${v}</div>` : '';
  document.addEventListener('mouseover', ev => {
    const a = ev.target.closest('a.ent'); if (!a) return;
    const e = byName.get(a.textContent); if (!e) return;
    const v = e[2];
    tip.innerHTML = `<b>${e[0]}</b>` + (e[1] === 'people'
      ? row('立場', v['立場']) + row('国の会議', v['会議']) + row('所属政党', v['政党']) + row('政治資金', v['政治資金'] && '収支報告書に記載あり')
      : row('正式名称', v['正式名称']) + row('公費', v['公費']) + row('関係人物', v['人物']) + row('収入', v['収入']))
      + `<div class="more">クリックで${e[1] === 'people' ? '人物' : '団体'}ファイルへ</div>`;
    tip.style.display = 'block';
  });
  document.addEventListener('mousemove', ev => {
    if (tip.style.display !== 'block') return;
    const x = Math.min(ev.clientX + 14, innerWidth - tip.offsetWidth - 8), y = ev.clientY + 16 + tip.offsetHeight > innerHeight ? ev.clientY - tip.offsetHeight - 10 : ev.clientY + 16;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });
  document.addEventListener('mouseout', ev => { if (ev.target.closest('a.ent')) tip.style.display = 'none'; });

  // ---- 人物・団体ファイル: 該当カードを強調 ----
  function hit() {
    const id = decodeURIComponent(location.hash.slice(1)); if (!id) return;
    const el = document.getElementById(id); if (!el) return;
    document.querySelectorAll('.hit').forEach(x => x.classList.remove('hit'));
    el.style.display = ''; el.classList.add('hit'); el.scrollIntoView({ block: 'start' }); scrollBy(0, -60);
    if (el.tagName === 'DETAILS') el.open = true;
  }
  addEventListener('hashchange', hit); hit();

  // ---- 表: 見出しクリックで並べ替え、行の多い表は絞り込み欄 ----
  document.querySelectorAll('table').forEach(tb => {
    const body = tb.tBodies[0]; if (!body) return;
    const rows = () => [...body.rows];
    if (body.rows.length > 8) {
      const f = document.createElement('input'); f.className = 'tfilter'; f.placeholder = `この表を絞り込み（${body.rows.length}行）`;
      f.oninput = () => { const q = f.value.trim(); rows().forEach(r => r.style.display = !q || r.textContent.includes(q) ? '' : 'none'); };
      (tb.closest('.tw') || tb).before(f);
    }
    tb.querySelectorAll('thead th').forEach((th, i) => {
      th.classList.add('sortable');
      th.onclick = () => {
        const asc = !th.classList.contains('asc');
        tb.querySelectorAll('th').forEach(x => x.classList.remove('asc', 'desc')); th.classList.add(asc ? 'asc' : 'desc');
        const val = r => { const s = (r.cells[i] || {}).textContent || ''; const n = parseFloat(s.replace(/[,円%\s]/g, '')); return isNaN(n) ? s : n; };
        rows().sort((a, b) => { const x = val(a), y = val(b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ja')) * (asc ? 1 : -1); })
          .forEach(r => body.append(r));
      };
    });
  });

  // ---- 目次: 広い画面では左に固定し、読んでいる節を強調 ----
  const toc = document.querySelector('.toc');
  if (toc) {
    toc.classList.add('side');
    const links = [...toc.querySelectorAll('a[href^="#"]')];
    const heads = links.map(a => document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)))).filter(Boolean);
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) links.forEach(a => a.classList.toggle('cur', a.getAttribute('href') === '#' + e.target.id));
    }), { rootMargin: '0px 0px -70% 0px' });
    heads.forEach(h => io.observe(h));
  }

  // ---- 上へ戻る ----
  const top = document.createElement('button'); top.id = 'totop'; top.textContent = '↑'; top.title = 'ページの先頭へ';
  top.onclick = () => scrollTo({ top: 0, behavior: 'smooth' }); document.body.append(top);
  addEventListener('scroll', () => { top.style.display = scrollY > 600 ? 'block' : 'none'; }, { passive: true });

  // ---- カード一覧（人物・団体ファイル）: タグで絞り込み ----
  const cards = [...document.querySelectorAll('.card')];
  const q = document.getElementById('q');
  if (cards.length && q) {
    const tags = [...new Set(cards.flatMap(c => [...c.querySelectorAll('.tag')].map(t => t.textContent)))];
    const chips = document.createElement('div'); chips.className = 'chips';
    const on = new Set();
    const apply = () => {
      const v = q.value.trim();
      let n = 0;
      cards.forEach(c => {
        const ct = [...c.querySelectorAll('.tag')].map(t => t.textContent);
        const ok = (!v || c.textContent.includes(v)) && [...on].every(t => ct.includes(t));
        c.style.display = ok ? '' : 'none'; n += ok;
      });
      q.placeholder = `名前・団体名・キーワードで絞り込み（${n}件表示）`;
    };
    tags.forEach(t => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => { on.has(t) ? on.delete(t) : on.add(t); b.classList.toggle('on'); apply(); }; chips.append(b); });
    q.after(chips); q.oninput = apply; apply();

    // data-sort のあるカード（人物ファイルの関係団体数）は並べ替えできる
    const label = cards[0].dataset.sortLabel;
    if (label) {
      const parent = cards[0].parentNode, end = cards[cards.length - 1].nextSibling;
      const sorter = document.createElement('div'); sorter.className = 'chips';
      const opts = [['標準の順', null], [`${label}が多い順`, -1], [`${label}が少ない順`, 1]];
      opts.forEach(([t, dir], i) => {
        const b = document.createElement('button'); b.textContent = t; if (i === 0) b.classList.add('on');
        b.onclick = () => {
          const list = dir === null ? cards : [...cards].sort((a, c) => (a.dataset.sort - c.dataset.sort) * dir);
          list.forEach(c => parent.insertBefore(c, end));
          sorter.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        };
        sorter.append(b);
      });
      const cap = document.createElement('span'); cap.textContent = '並び順:'; cap.style.cssText = 'font-size:12px;color:#8a8984;align-self:center';
      sorter.prepend(cap); chips.after(sorter);
    }
  }
})();
