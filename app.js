(function () {
  'use strict';
  var TIERS = { perfect: ['Perfect', '★★★'], good: ['Good', '★★'], poor: ['Poor', '★'] };
  var animals = [], tier = 'perfect', query = '';
  var active = -1, shown = [];

  var $ = function (id) { return document.getElementById(id); };
  var grid = $('grid'), input = $('search'), list = $('suggestions'), clearBtn = $('clear');
  var countEl = $('count'), emptyEl = $('empty'), errorEl = $('error');

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function money(n) { return '$' + n.toFixed(2); }
  function words(s) { return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean); }

  /* ---------- cards ---------- */
  function bars(item, scale) {
    var ul = el('ul', 'bars'), t = TIERS[tier][0];
    [['Butcher', 'butcher'], ['Trapper', 'trapper']].forEach(function (r) {
      var v = item[r[1]] ? item[r[1]][tier] : null;
      var li = el('li', v == null ? 'none' : '');
      li.appendChild(el('span', 'sr', r[0] + ', ' + t + ': ' + (v == null ? 'no price' : money(v))));
      var lbl = el('span', 'lbl', r[0]); lbl.setAttribute('aria-hidden', 'true');
      var track = el('span', 'track'); track.setAttribute('aria-hidden', 'true');
      if (v != null) {
        var b = el('span', 'bar ' + r[1]);
        b.style.width = Math.max(2, v / scale * 100) + '%';
        track.appendChild(b);
      }
      var val = el('span', 'val', v == null ? '—' : money(v)); val.setAttribute('aria-hidden', 'true');
      li.appendChild(lbl); li.appendChild(track); li.appendChild(val);
      ul.appendChild(li);
    });
    return ul;
  }

  function trade(label, item, scale) {
    var sec = el('section', 'item');
    sec.appendChild(el('h3', null, label));
    if (!item || !item.item || !item.butcher) {
      sec.appendChild(el('p', 'dash', '—'));
      if (item && item.note) sec.appendChild(el('p', 'inote', item.note));
      return sec;
    }
    sec.appendChild(el('p', 'iname', item.item));
    sec.appendChild(bars(item, scale));
    var missing = !item.trapper || item.trapper[tier] == null;
    if (missing && item.trapperNote) sec.appendChild(el('p', 'inote', item.trapperNote));
    if (item.note) sec.appendChild(el('p', 'inote', item.note));
    return sec;
  }

  function maxOf(item) {
    var m = 0;
    if (item && item.butcher) ['butcher', 'trapper'].forEach(function (k) {
      if (item[k] && item[k][tier] > m) m = item[k][tier];
    });
    return m;
  }

  function card(a) {
    var c = el('article', 'card'); c.id = a.id;
    c.dataset.id = a.id;
    var h = el('h2', null, a.name); c.appendChild(h);
    c.appendChild(el('p', 'group', a.group));
    var pill = el('p', 'pill');
    var st = el('span', 'stars', TIERS[tier][1]); st.setAttribute('aria-hidden', 'true');
    pill.appendChild(st); pill.appendChild(document.createTextNode(TIERS[tier][0] + ' quality'));
    c.appendChild(pill);
    var scale = Math.max(maxOf(a.carcass), maxOf(a.pelt), 0.01);
    c.appendChild(trade('Whole carcass', a.carcass, scale));
    c.appendChild(trade('Pelt', a.pelt, scale));
    var meat = el('section', 'item');
    meat.appendChild(el('h3', null, 'Main meat'));
    if (a.meat && a.meat.value != null) {
      var row = el('p', 'meatrow');
      row.appendChild(el('span', null, a.meat.item));
      var r = el('span', 'val', money(a.meat.value) + ' ');
      r.appendChild(el('span', 'sub', 'each, any quality'));
      row.appendChild(r);
      meat.appendChild(row);
    } else {
      meat.appendChild(el('p', 'dash', '—'));
    }
    c.appendChild(meat);
    if (a.tip || a.weapon) {
      var ex = el('div', 'extra');
      if (a.tip) ex.appendChild(el('p', null, a.tip));
      if (a.weapon) ex.appendChild(el('p', null, 'Best for a clean kill: ' + a.weapon));
      c.appendChild(ex);
    }
    return c;
  }

  function renderCards() {
    var f = document.createDocumentFragment();
    animals.forEach(function (a) { f.appendChild(card(a)); });
    grid.textContent = '';
    grid.appendChild(f);
    applyFilter();
  }

  /* ---------- matching ---------- */
  // score 0 = word start / prefix, 1 = substring, -1 = none
  function score(text, q) {
    var t = text.toLowerCase();
    if (t.indexOf(q) === 0) return 0;
    var w = words(t);
    for (var i = 0; i < w.length; i++) if (w[i].indexOf(q) === 0) return 0;
    return t.indexOf(q) >= 0 ? 1 : -1;
  }
  function matches(q) {
    q = q.trim().toLowerCase();
    if (!q) return animals.map(function (a, i) { return { a: a, i: i, s: 0, via: null }; });
    var out = [];
    animals.forEach(function (a, i) {
      var best = score(a.name, q), via = null;
      (a.aka || []).forEach(function (k) {
        var s = score(k, q);
        if (s >= 0 && (best < 0 || s < best)) { best = s; via = k; }
      });
      if (best >= 0) out.push({ a: a, i: i, s: best, via: via });
    });
    return out;
  }

  function applyFilter() {
    var ids = {};
    matches(query).forEach(function (m) { ids[m.a.id] = true; });
    var n = 0;
    Array.prototype.forEach.call(grid.children, function (c) {
      var ok = !!ids[c.dataset.id];
      c.hidden = !ok;
      if (ok) n++;
    });
    var total = animals.length;
    countEl.textContent = query.trim() ? n + ' of ' + total + ' animals' : total + ' animals';
    emptyEl.hidden = n !== 0;
  }

  /* ---------- suggestions ---------- */
  function setActive(i) {
    var items = list.children;
    if (active >= 0 && items[active]) items[active].setAttribute('aria-selected', 'false');
    active = i;
    if (i >= 0 && items[i]) {
      items[i].setAttribute('aria-selected', 'true');
      input.setAttribute('aria-activedescendant', items[i].id);
      items[i].scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }
  function closeList() {
    list.hidden = true; list.textContent = '';
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1; shown = [];
  }
  function openList() {
    var q = input.value.trim();
    if (!q) return closeList();
    shown = matches(q).sort(function (x, y) { return x.s - y.s || x.i - y.i; }).slice(0, 8);
    list.textContent = '';
    active = -1;
    if (!shown.length) return closeList();
    shown.forEach(function (m, i) {
      var li = el('li'); li.id = 'sg-' + m.a.id; li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.appendChild(el('span', null, m.a.name));
      if (m.via) li.appendChild(el('span', 'aka', 'also called ' + m.via));
      li.addEventListener('mousedown', function (e) { e.preventDefault(); });
      li.addEventListener('click', function () { choose(m.a.id); });
      list.appendChild(li);
    });
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function choose(id) {
    closeList();
    input.value = ''; query = ''; clearBtn.hidden = true;
    applyFilter();
    history.replaceState(null, '', '#' + id);
    goTo(id);
  }
  var flashTimer;
  function goTo(id) {
    var c = document.getElementById(id);
    if (!c || !c.classList.contains('card')) return;
    if (c.hidden) { input.value = ''; query = ''; clearBtn.hidden = true; applyFilter(); }
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    c.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    document.querySelectorAll('.card.flash').forEach(function (x) { x.classList.remove('flash'); });
    c.classList.add('flash');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { c.classList.remove('flash'); }, 1800);
  }

  input.addEventListener('input', function () {
    query = input.value;
    clearBtn.hidden = !query;
    applyFilter(); openList();
  });
  input.addEventListener('keydown', function (e) {
    var open = !list.hidden, n = shown.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) openList(); else setActive(active + 1 >= n ? 0 : active + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (open) setActive(active <= 0 ? n - 1 : active - 1);
    } else if (e.key === 'Enter') {
      if (open && n) { e.preventDefault(); choose(shown[active >= 0 ? active : 0].a.id); }
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); closeList(); }
      else if (input.value) { input.value = ''; query = ''; clearBtn.hidden = true; applyFilter(); }
    } else if (e.key === 'Tab') closeList();
  });
  input.addEventListener('blur', closeList);
  input.addEventListener('focus', function () { if (input.value.trim()) openList(); });
  clearBtn.addEventListener('click', function () {
    input.value = ''; query = ''; clearBtn.hidden = true;
    closeList(); applyFilter(); input.focus();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    e.preventDefault(); input.focus(); input.select();
  });

  /* ---------- tier ---------- */
  document.querySelectorAll('input[name="tier"]').forEach(function (r) {
    r.addEventListener('change', function () {
      if (!r.checked) return;
      tier = r.value; renderCards();
    });
  });

  /* ---------- sticky bar ---------- */
  var bar = document.querySelector('.searchbar'), sentinel = $('stick-sentinel');
  if (bar && sentinel && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      var e = es[es.length - 1];
      bar.classList.toggle('is-stuck', !e.isIntersecting && e.boundingClientRect.top < 0);
    }).observe(sentinel);
  }
  if (bar && 'ResizeObserver' in window) {
    new ResizeObserver(function () {
      document.documentElement.style.setProperty('--stick-h', Math.ceil(bar.getBoundingClientRect().height) + 'px');
    }).observe(bar);
  }

  window.addEventListener('hashchange', function () {
    var id = decodeURIComponent(location.hash.slice(1));
    if (id && animals.length) goTo(id);
  });

  /* ---------- load ---------- */
  fetch('data.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      animals = d.animals || [];
      var t = $('checked');
      if (d.meta && d.meta.lastChecked) {
        t.textContent = d.meta.lastChecked; t.setAttribute('datetime', d.meta.lastChecked);
      } else t.textContent = 'unknown';
      renderCards();
      var id = decodeURIComponent(location.hash.slice(1));
      if (id) goTo(id);
    })
    .catch(function () {
      countEl.textContent = '';
      errorEl.hidden = false;
      $('checked').textContent = 'unknown';
    });
})();
