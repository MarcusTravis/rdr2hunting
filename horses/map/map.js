(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var CONF = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' };
  var $ = function (id) { return document.getElementById(id); };
  var overlay = $('overlay'), headEl = $('head'), tappedEl = $('tapped'),
      placesEl = $('places'), coatsEl = $('coatlinks'), errorEl = $('error');

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function link(href, text) { var a = el('a', null, text); a.href = href; return a; }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  var areas = [], areaById = {}, wild = [], wildById = {}, coats = {};
  var breedAreas = {};          // breed -> Set of area ids (shared by breed or coat-specific)
  var areaBreeds = {};          // area id -> Set of breeds that spawn there

  /* ---------- data helpers ---------- */
  function addLink(breed, aid) {
    if (!breed || !areaById[aid]) return;
    (breedAreas[breed] = breedAreas[breed] || new Set()).add(aid);
    (areaBreeds[aid] = areaBreeds[aid] || new Set()).add(breed);
  }
  function coatAreas(id) {
    var c = coats[id], out = [];
    if (!c) return out;
    if (c.areas) out = c.areas.slice();
    else if (c.breed) areas.forEach(function (a) { if ((a.breeds || []).indexOf(c.breed) >= 0) out.push(a.id); });
    (c.extra || []).forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); });
    return out.filter(function (x) { return areaById[x]; });
  }
  function buildIndexes() {
    areas.forEach(function (a) { (a.breeds || []).forEach(function (b) { addLink(b, a.id); }); });
    wild.forEach(function (h) { coatAreas(h.id).forEach(function (aid) { addLink(h.breed, aid); }); });
  }

  /* ---------- zoom ---------- */
  var inner = $('mapinner'), mapImg = $('mapimg'), toggle = $('zoomtoggle');
  var baseSizes = mapImg.getAttribute('sizes');
  var ASPECT = 3200 / 2441;
  var zoomList = [], zoomed = true;

  function setView(vw, vl, vt) {
    var z = 100 / vw;
    inner.style.width = (z * 100) + '%';
    inner.style.height = (z * 100) + '%';
    inner.style.left = (-vl * z) + '%';
    inner.style.top = (-vt * z) + '%';
    mapImg.sizes = z > 1.0001 ? Math.round(z * 100) + 'vw' : baseSizes;
  }
  function applyZoom() {
    if (!zoomList.length || !zoomed) { setView(100, 0, 0); }
    else {
      var l = Infinity, rt = -Infinity, t = Infinity, b = -Infinity;
      zoomList.forEach(function (a) {
        var ry = a.r * ASPECT;
        l = Math.min(l, a.x - a.r); rt = Math.max(rt, a.x + a.r);
        t = Math.min(t, a.y - ry); b = Math.max(b, a.y + ry);
      });
      var padX = 6, padY = 6 * ASPECT;
      l -= padX; rt += padX; t -= padY; b += padY;
      // same fraction of width and height keeps the map aspect, so compare both spans as percents
      var vw = Math.min(100, Math.max(40, rt - l, b - t));
      var cx = (l + rt) / 2, cy = (t + b) / 2;
      var vl = Math.max(0, Math.min(100 - vw, cx - vw / 2));
      var vt = Math.max(0, Math.min(100 - vw, cy - vw / 2));
      setView(vw, vl, vt);
    }
  }
  function setupZoom(list) {
    zoomList = list;
    zoomed = true;
    toggle.hidden = !list.length;
    updateToggle();
    applyZoom();
  }
  function updateToggle() {
    toggle.setAttribute('aria-pressed', zoomed ? 'true' : 'false');
    toggle.textContent = zoomed ? 'Show whole map' : 'Zoom to spots';
  }
  toggle.addEventListener('click', function () {
    zoomed = !zoomed;
    updateToggle();
    applyZoom();
  });

  /* ---------- drawing ---------- */
  function draw(list) {
    overlay.textContent = '';
    list.forEach(function (a) {
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', (a.x * 32).toFixed(1));
      c.setAttribute('cy', (a.y * 24.41).toFixed(1));
      c.setAttribute('r', (a.r * 32).toFixed(1));
      c.setAttribute('fill', '#e02020');
      c.setAttribute('fill-opacity', '0.5');
      c.setAttribute('data-id', a.id);
      c.setAttribute('tabindex', '0');
      c.setAttribute('role', 'button');
      var label = a.name + ', ' + a.region;
      c.setAttribute('aria-label', label);
      var t = document.createElementNS(NS, 'title');
      t.textContent = label;
      c.appendChild(t);
      var show = function () { tappedEl.textContent = 'Tapped: ' + label; };
      c.addEventListener('click', show);
      c.addEventListener('focus', show);
      c.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(); }
      });
      overlay.appendChild(c);
    });
    tappedEl.textContent = list.length ? 'Tap a circle to see its name.' : 'No areas to show.';
  }

  function placeItem(a, badges) {
    var li = el('li');
    li.appendChild(el('strong', null, a.name));
    li.appendChild(el('span', 'region', ' — ' + a.region));
    var b = el('div', 'badges');
    (badges || []).forEach(function (n) { b.appendChild(el('span', 'badge', n)); });
    if (a.epilogue) b.appendChild(el('span', 'badge epi', 'Epilogue only'));
    if (b.children.length) { b.style.marginTop = '4px'; li.appendChild(b); }
    if (a.note) li.appendChild(el('p', 'anote', a.note));
    return li;
  }
  function placesBlock(list, withBreeds) {
    placesEl.textContent = '';
    placesEl.appendChild(el('h2', null, 'Named places'));
    if (!list.length) { placesEl.appendChild(el('p', 'muted', 'No places listed.')); return; }
    var ul = el('ul');
    list.forEach(function (a) {
      var br = withBreeds ? Array.from(areaBreeds[a.id] || []).sort() : [];
      ul.appendChild(placeItem(a, br));
    });
    placesEl.appendChild(ul);
    if (list.some(function (a) { return a.epilogue; })) {
      placesEl.appendChild(el('p', 'epinote', 'New Austin can only be reached as John in the Epilogue, so places marked “Epilogue only” aren’t available during the main story.'));
    }
  }

  /* ---------- modes ---------- */
  function showSingle(h) {
    var cd = coats[h.id] || {};
    var list = coatAreas(h.id).map(function (id) { return areaById[id]; });
    document.title = h.name + ' map — RDR2 Horse Hunting (Story Mode)';
    headEl.textContent = '';
    headEl.appendChild(el('h2', null, h.name));
    headEl.appendChild(el('p', null, [h.breed, h.coat].filter(Boolean).join(' · ')));
    var p = el('p');
    p.appendChild(el('span', 'conf ' + (CONF[cd.conf] ? cd.conf : ''), CONF[cd.conf] || 'Confidence unknown'));
    headEl.appendChild(p);
    if (cd.rare) headEl.appendChild(el('p', null, 'Rare in these herds: the coat is random within its breed’s herds, so circles show where the breed roams.'));
    if (cd.note) headEl.appendChild(el('p', null, cd.note));
    var links = el('div', 'links');
    links.appendChild(link('/horses/?cat=wild', '← Back to wild horses'));
    links.appendChild(link('/horses/map/', 'See all wild herds'));
    headEl.appendChild(links);
    draw(list);
    setupZoom(list);
    placesBlock(list, false);
    coatsEl.hidden = true;
  }

  function showAll(unknown) {
    var params = new URLSearchParams(location.search);
    var breeds = Object.keys(breedAreas).sort();
    wild.forEach(function (h) { if (h.breed && breeds.indexOf(h.breed) < 0) breeds.push(h.breed); });
    breeds.sort();
    var cur = breeds.filter(function (b) { return slug(b) === params.get('breed'); })[0] || '';

    headEl.textContent = '';
    if (unknown) {
      var w = el('p', 'warn', 'That horse isn’t a wild horse, so it has no map.');
      headEl.appendChild(w);
      var l1 = el('div', 'links');
      l1.appendChild(link('/horses/?cat=wild', '← Back to wild horses'));
      l1.appendChild(link('/horses/map/', 'See all wild herds'));
      headEl.appendChild(l1);
    }
    var f = el('div', 'filter');
    var lab = el('label', null, 'Breed'); lab.htmlFor = 'breed';
    var sel = el('select'); sel.id = 'breed';
    var o = el('option', null, 'All breeds'); o.value = ''; sel.appendChild(o);
    breeds.forEach(function (b) { var op = el('option', null, b); op.value = slug(b); sel.appendChild(op); });
    sel.value = cur ? slug(cur) : '';
    f.appendChild(lab); f.appendChild(sel);
    headEl.appendChild(f);
    sel.addEventListener('change', function () {
      var b = breeds.filter(function (x) { return slug(x) === sel.value; })[0] || '';
      var u = new URL(location.href);
      u.searchParams.delete('horse');
      if (b) u.searchParams.set('breed', slug(b)); else u.searchParams.delete('breed');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
      render(b);
    });
    document.title = 'Wild Horse Map — RDR2 Horse Hunting (Story Mode)';
    render(cur);
    renderCoatLinks(breeds);
  }

  function render(breed) {
    var list = areas.filter(function (a) { return !breed || (breedAreas[breed] && breedAreas[breed].has(a.id)); });
    draw(list);
    setupZoom([]);
    placesBlock(list, true);
  }

  function renderCoatLinks(breeds) {
    coatsEl.textContent = '';
    coatsEl.hidden = false;
    coatsEl.appendChild(el('h2', null, 'Map for each wild coat'));
    breeds.forEach(function (b) {
      var hs = wild.filter(function (h) { return h.breed === b; });
      if (!hs.length) return;
      var g = el('div', 'coatgroup');
      g.appendChild(el('h3', null, b));
      var ul = el('ul');
      hs.forEach(function (h) {
        var li = el('li');
        li.appendChild(link('/horses/map/?horse=' + encodeURIComponent(h.id), h.name));
        ul.appendChild(li);
      });
      g.appendChild(ul);
      coatsEl.appendChild(g);
    });
  }

  /* ---------- load ---------- */
  function getJSON(u) {
    return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  Promise.all([getJSON('/horses/wild-locations.json'), getJSON('/horses/horses.json')])
    .then(function (res) {
      var loc = res[0], hs = res[1].horses || [];
      areas = loc.areas || [];
      coats = loc.coats || {};
      areas.forEach(function (a) { areaById[a.id] = a; });
      wild = hs.filter(function (h) { return (h.categories || []).indexOf('wild') >= 0; });
      wild.forEach(function (h) { wildById[h.id] = h; });
      buildIndexes();
      var id = new URLSearchParams(location.search).get('horse');
      if (id && id !== 'all') {
        if (wildById[id]) showSingle(wildById[id]); else showAll(true);
      } else showAll(false);
    })
    .catch(function () { errorEl.hidden = false; tappedEl.textContent = ''; });
})();
