(function () {
  'use strict';
  var CATS = { common: 'Common', wild: 'Wild', stable: 'Stable', special: 'Special' };
  var horses = [], cat = 'any', query = '', scale = 1;
  var active = -1, shown = [];
  var removed = new Set();

  var $ = function (id) { return document.getElementById(id); };
  var grid = $('grid'), input = $('search'), list = $('suggestions'), clearBtn = $('clear');
  var countEl = $('count'), emptyEl = $('empty'), errorEl = $('error');

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function money(n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function num(v) { return typeof v === 'number' && !isNaN(v) ? v : null; }
  function words(s) { return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean); }

  /* ---------- cards ---------- */
  var X_SVG = '<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" focusable="false"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  function removeBtn(h) {
    var b = el('button', 'tempremove');
    b.type = 'button';
    b.setAttribute('aria-label', 'Temporarily remove ' + h.name);
    b.title = 'Temporarily remove ' + h.name;
    b.innerHTML = X_SVG + '<span>Temp remove</span>';
    return b;
  }
  function barRows(h) {
    var f = h.fence || {};
    var ul = el('ul', 'bars');
    [['Bond 1', num(f.bond1)], ['Bond 4', num(f.bond4)]].forEach(function (r) {
      var v = r[1];
      var li = el('li', v == null ? 'none' : '');
      li.appendChild(el('span', 'sr', r[0] + ': ' + (v == null ? 'no price' : money(v))));
      var lbl = el('span', 'lbl', r[0]); lbl.setAttribute('aria-hidden', 'true');
      var track = el('span', 'track'); track.setAttribute('aria-hidden', 'true');
      if (v != null) {
        var b = el('span', 'bar butcher');
        b.style.width = Math.max(2, v / scale * 100) + '%';
        track.appendChild(b);
      }
      var val = el('span', 'val', v == null ? '—' : money(v)); val.setAttribute('aria-hidden', 'true');
      li.appendChild(lbl); li.appendChild(track); li.appendChild(val);
      ul.appendChild(li);
    });
    return ul;
  }
  function card(h) {
    var c = el('article', 'card hcard');
    c.id = h.id; c.dataset.id = h.id;
    c.appendChild(removeBtn(h));
    c.appendChild(el('h2', null, h.name));
    c.appendChild(el('p', 'group', [h.breed, h.coat].filter(Boolean).join(' · ')));
    var pills = el('ul', 'cat-pills');
    (h.categories || []).forEach(function (k) { if (CATS[k]) pills.appendChild(el('li', null, CATS[k])); });
    c.appendChild(pills);
    c.appendChild(barRows(h));
    var f = h.fence || {};
    var noteShown = false;
    if (num(f.bond4) == null || !h.fenceable) {
      var t = h.note || (h.fenceable ? 'No payout confirmed yet.' : 'This horse can’t be sold to the fence.');
      c.appendChild(el('p', 'inote', t));
      noteShown = !!h.note;
    }
    var bits = [];
    if (num(f.bond0) != null) bits.push('Just stolen or tamed: ' + money(f.bond0));
    if (num(h.stablePrice) != null) bits.push('Stable price: ' + money(h.stablePrice));
    if (bits.length) c.appendChild(el('p', 'prices', bits.join(' · ')));
    if (h.where) c.appendChild(el('p', 'where', h.where));
    if (h.note && !noteShown) c.appendChild(el('p', 'note', h.note));
    var label = h.name + ', ' + (num(f.bond4) == null ? 'no max bond price' : 'max bond ' + money(f.bond4));
    c.setAttribute('aria-label', label);
    return c;
  }

  function renderCards() {
    var f = document.createDocumentFragment();
    horses.forEach(function (h) { f.appendChild(card(h)); });
    grid.textContent = '';
    grid.appendChild(f);
    applySort();
    applyFilter();
  }

  /* ---------- sort ---------- */
  var SORTS = {
    none: ['Sort by price', ''],
    desc: ['Sorted by price, highest first', ', sorted by price, highest first'],
    asc: ['Sorted by price, lowest first', ', sorted by price, lowest first']
  };
  var sortMode = 'desc', sortBtn = $('sort');

  function applySort() {
    var nodes = {};
    Array.prototype.forEach.call(grid.children, function (c) { nodes[c.dataset.id] = c; });
    var rows = horses.map(function (h, i) { return { id: h.id, i: i, v: num(h.fence && h.fence.bond4) }; });
    rows.sort(function (x, y) {
      if (sortMode !== 'none') {
        if (x.v == null && y.v != null) return 1;
        if (y.v == null && x.v != null) return -1;
        if (x.v != null && x.v !== y.v) return sortMode === 'desc' ? y.v - x.v : x.v - y.v;
      }
      return x.i - y.i;
    });
    rows.forEach(function (r) { if (nodes[r.id]) grid.appendChild(nodes[r.id]); });
  }
  function syncSortUI() {
    sortBtn.dataset.sort = sortMode;
    sortBtn.setAttribute('aria-pressed', sortMode === 'none' ? 'false' : 'true');
    sortBtn.setAttribute('aria-label', SORTS[sortMode][0]);
    sortBtn.title = SORTS[sortMode][0];
  }
  function saveState() {
    var u = new URL(location.href);
    if (sortMode === 'desc') u.searchParams.delete('sort'); else u.searchParams.set('sort', sortMode);
    if (cat === 'any') u.searchParams.delete('cat'); else u.searchParams.set('cat', cat);
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
  }
  sortBtn.addEventListener('click', function () {
    sortMode = sortMode === 'desc' ? 'asc' : sortMode === 'asc' ? 'none' : 'desc';
    syncSortUI(); saveState(); applySort(); applyFilter();
  });

  /* ---------- matching ---------- */
  // score 0 = word start / prefix, 1 = substring, -1 = none
  function score(text, q) {
    var t = String(text).toLowerCase();
    if (t.indexOf(q) === 0) return 0;
    var w = words(t);
    for (var i = 0; i < w.length; i++) if (w[i].indexOf(q) === 0) return 0;
    return t.indexOf(q) >= 0 ? 1 : -1;
  }
  function inCat(h) { return cat === 'any' || (h.categories || []).indexOf(cat) >= 0; }
  function matches(q) {
    q = q.trim().toLowerCase();
    var out = [];
    horses.forEach(function (h, i) {
      if (removed.has(h.id) || !inCat(h)) return;
      if (!q) { out.push({ h: h, i: i, s: 0, via: null }); return; }
      var best = score(h.name, q), via = null;
      [h.breed, h.coat].concat((h.categories || []).map(function (k) { return CATS[k] || k; })).forEach(function (t) {
        var s = t ? score(t, q) : -1;
        if (s >= 0 && (best < 0 || s < best)) best = s;
      });
      (h.aka || []).forEach(function (k) {
        var s = score(k, q);
        if (s >= 0 && (best < 0 || s < best)) { best = s; via = k; }
      });
      if (best >= 0) out.push({ h: h, i: i, s: best, via: via });
    });
    return out;
  }

  function applyFilter() {
    var ids = {};
    matches(query).forEach(function (m) { ids[m.h.id] = true; });
    var n = 0, total = 0;
    Array.prototype.forEach.call(grid.children, function (c) {
      var id = c.dataset.id, gone = removed.has(id);
      var h = byId(id);
      var ok = !gone && !!ids[id];
      c.hidden = !ok && !(gone && c.classList.contains('leaving'));
      if (ok) n++;
      if (!gone && h && inCat(h)) total++;
    });
    countEl.textContent = (query.trim() ? n + ' of ' + total : total) + (total === 1 && !query.trim() ? ' horse' : ' horses') +
      (removed.size ? ' · ' + removed.size + ' removed' : '') + SORTS[sortMode][1];
    emptyEl.hidden = n !== 0;
  }
  function byId(id) {
    for (var i = 0; i < horses.length; i++) if (horses[i].id === id) return horses[i];
    return null;
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
    shown.forEach(function (m) {
      var li = el('li'); li.id = 'sg-' + m.h.id; li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.appendChild(el('span', null, m.h.name));
      if (m.via) li.appendChild(el('span', 'aka', 'also called ' + m.via));
      else if (m.h.breed && m.h.name.toLowerCase().indexOf(m.h.breed.toLowerCase()) < 0) li.appendChild(el('span', 'aka', m.h.breed));
      li.addEventListener('mousedown', function (e) { e.preventDefault(); });
      li.addEventListener('click', function () { choose(m.h.id); });
      list.appendChild(li);
    });
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function clearSearch() { input.value = ''; query = ''; clearBtn.hidden = true; }
  function choose(id) {
    closeList();
    clearSearch();
    applyFilter();
    history.replaceState(null, '', location.pathname + location.search + '#' + id);
    goTo(id);
  }
  var flashTimer;
  function goTo(id) {
    if (removed.has(id)) return;
    var c = document.getElementById(id);
    if (!c || !c.classList.contains('card')) return;
    var h = byId(id);
    if (h && !inCat(h)) { // card's category is not shown; switch to Any
      cat = 'any'; $('cat-any').checked = true; saveState(); applyFilter();
    }
    if (c.hidden) { clearSearch(); applyFilter(); }
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
      if (open && n) { e.preventDefault(); choose(shown[active >= 0 ? active : 0].h.id); }
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); closeList(); }
      else if (input.value) { clearSearch(); applyFilter(); }
    } else if (e.key === 'Tab') closeList();
  });
  input.addEventListener('blur', closeList);
  input.addEventListener('focus', function () { if (input.value.trim()) openList(); });
  clearBtn.addEventListener('click', function () {
    clearSearch(); closeList(); applyFilter(); input.focus();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    e.preventDefault(); input.focus(); input.select();
  });

  /* ---------- temp remove / reset ---------- */
  var resetBtn = $('resetpage'), root = document.documentElement;
  function reduceMotion() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function updateReset() {
    var n = removed.size;
    resetBtn.hidden = n === 0;
    root.classList.toggle('has-reset', n > 0);
    resetBtn.querySelector('.rtext').textContent = 'Reset page (' + n + ' removed)';
    resetBtn.setAttribute('aria-label', 'Reset page and bring back ' + n + ' removed ' + (n === 1 ? 'horse' : 'horses'));
  }
  function nextFocusTarget(card) {
    var all = [], n;
    for (n = card.nextElementSibling; n; n = n.nextElementSibling) all.push(n);
    for (n = card.previousElementSibling; n; n = n.previousElementSibling) all.push(n);
    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      if (!c.hidden && !removed.has(c.dataset.id)) {
        var b = c.querySelector('.tempremove');
        if (b) return b;
      }
    }
    return input;
  }
  grid.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.tempremove') : null;
    if (!b || !grid.contains(b)) return;
    e.preventDefault(); e.stopPropagation();
    var c = b.closest('.card'), id = c.dataset.id;
    if (removed.has(id)) return;
    removed.add(id);
    var target = nextFocusTarget(c);
    var animate = !reduceMotion();
    if (animate) c.classList.add('leaving');
    closeList();
    applyFilter(); updateReset();
    target.focus({ preventScroll: true });
    if (animate) setTimeout(function () { c.classList.remove('leaving'); applyFilter(); }, 230);
  });
  resetBtn.addEventListener('click', function () {
    removed.clear();
    cat = 'any'; $('cat-any').checked = true;
    sortMode = 'desc'; syncSortUI();
    clearSearch(); closeList();
    history.replaceState(null, '', location.pathname);
    applySort(); applyFilter(); updateReset();
    window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
    input.focus({ preventScroll: true });
  });

  /* ---------- category ---------- */
  document.querySelectorAll('input[name="cat"]').forEach(function (r) {
    r.addEventListener('change', function () {
      if (!r.checked) return;
      cat = r.value; saveState(); closeList(); applyFilter();
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
      root.style.setProperty('--stick-h', Math.ceil(bar.getBoundingClientRect().height) + 'px');
    }).observe(bar);
  }

  window.addEventListener('hashchange', function () {
    var id = decodeURIComponent(location.hash.slice(1));
    if (id && horses.length) goTo(id);
  });

  /* ---------- load ---------- */
  fetch('/horses/horses.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      horses = d.horses || [];
      scale = Math.max.apply(null, horses.map(function (h) { return num(h.fence && h.fence.bond4) || 0; }).concat(0.01));
      var t = $('checked');
      if (d.meta && d.meta.lastChecked) {
        t.textContent = d.meta.lastChecked; t.setAttribute('datetime', d.meta.lastChecked);
      } else t.textContent = 'unknown';
      var sp = new URLSearchParams(location.search).get('sort');
      if (sp === 'asc' || sp === 'none') sortMode = sp;
      var cp = new URLSearchParams(location.search).get('cat');
      if (CATS[cp]) cat = cp;
      var radio = $('cat-' + cat);
      if (radio) radio.checked = true;
      syncSortUI();
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
