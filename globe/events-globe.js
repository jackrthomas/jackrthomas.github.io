/* Events globe
 * ---------------------------------------------------------------------------
 * Draws a rotatable globe above/beside the events list on events.html.
 * - Events are read from the page itself (.year-group > .event), so there is no
 *   second list to keep up to date. Each event's place comes from its .ev-where
 *   text, looked up in PLACES below. To place an event precisely (or one that is
 *   not in PLACES), add data-lat="..." data-lon="..." to its <div class="event">.
 * - Click a dot: the list scrolls to that event and highlights it. Click an event
 *   in the list: the globe turns to it. The All / Talks / Seminars / Conferences
 *   filter also filters the dots.
 * - Needs globe/world-110m.js (country outlines) loaded first. No libraries.
 * If anything is missing the globe stays hidden and the list works as before.
 */
(function () {
  'use strict';
  var layout = document.querySelector('.ev-layout');
  var cv = document.getElementById('ev-globe');
  if (!layout || !cv || !cv.getContext || !window.EVENTS_GLOBE_WORLD) return;

  /* ---- where events happened: substring of the .ev-where text -> [lat, lon] ---- */
  var PLACES = [
    ['imsi', 41.790, -87.600], ['flatiron', 40.741, -73.988], ['university of minnesota', 44.974, -93.228],
    ['gran sasso', 42.347, 13.392], ['herrsching', 47.999, 11.173], ['toulouse', 43.605, 1.444], ['ihes', 48.699, 2.167],
    ['henri poincar', 48.845, 2.346], ['jacques-louis lions', 48.847, 2.357], ['tu wien', 48.199, 16.370],
    ['ipam', 34.070, -118.442], ['university of oxford', 51.755, -1.254], ['university of cambridge', 52.205, 0.122],
    ['university of glasgow', 55.872, -4.288], ['university of warwick', 52.379, -1.562], ['suzhou', 31.299, 120.585],
    ['borth', 52.490, -4.051], ['university of bath', 51.379, -2.327], ['roscoff', 48.726, -3.987],
    /* general fall-backs for future events */
    ['new york', 40.713, -74.006], ['chicago', 41.878, -87.630], ['boston', 42.360, -71.059], ['princeton', 40.357, -74.667],
    ['los angeles', 34.052, -118.244], ['berkeley', 37.872, -122.273], ['san francisco', 37.775, -122.419], ['seattle', 47.606, -122.332],
    ['minneapolis', 44.978, -93.265], ['london', 51.507, -0.128], ['edinburgh', 55.953, -3.188], ['manchester', 53.481, -2.243],
    ['paris', 48.857, 2.352], ['lyon', 45.764, 4.836], ['berlin', 52.520, 13.405], ['munich', 48.135, 11.582], ['vienna', 48.208, 16.373],
    ['zurich', 47.377, 8.541], ['rome', 41.903, 12.496], ['milan', 45.464, 9.190], ['barcelona', 41.385, 2.173], ['madrid', 40.417, -3.704],
    ['amsterdam', 52.368, 4.904], ['copenhagen', 55.676, 12.568], ['stockholm', 59.329, 18.069], ['oslo', 59.914, 10.752], ['helsinki', 60.170, 24.941],
    ['prague', 50.088, 14.438], ['warsaw', 52.230, 21.012], ['tokyo', 35.676, 139.650], ['kyoto', 35.012, 135.768], ['beijing', 39.904, 116.407],
    ['shanghai', 31.230, 121.474], ['hong kong', 22.320, 114.169], ['singapore', 1.352, 103.820], ['sydney', -33.869, 151.209],
    ['toronto', 43.653, -79.383], ['montreal', 45.502, -73.567], ['vancouver', 49.283, -123.121]
  ];
  var SELECT_ZOOM = 3.5;   // how far the globe zooms in when an event is picked (1 = whole globe)
  var KIND_COLOUR = { talk: '#700038', seminar: '#5b3069', conf: '#8a8a8a' };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- read the events from the page ---- */
  function txt(el, sel) { var n = el.querySelector(sel); return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function find(where) {
    var w = where.toLowerCase().replace(/[‘’]/g, "'");
    for (var i = 0; i < PLACES.length; i++) if (w.indexOf(PLACES[i][0]) !== -1) return PLACES[i];
    return null;
  }
  var events = [].slice.call(document.querySelectorAll('.year-group .event')).map(function (el) {
    var yl = el.closest('.year-group').querySelector('.year-label');
    var e = { el: el, year: yl ? yl.textContent.trim() : '', month: txt(el, '.ev-month'), title: txt(el, '.ev-title'), where: txt(el, '.ev-where'),
      kind: el.classList.contains('seminar') ? 'seminar' : el.classList.contains('talk') ? 'talk' : 'conf', lat: null, lon: null, why: '' };
    if (el.dataset.lat && el.dataset.lon && isFinite(el.dataset.lat) && isFinite(el.dataset.lon)) { e.lat = +el.dataset.lat; e.lon = +el.dataset.lon; }
    else if (!e.where) e.why = 'none';
    else if (/online|virtual/i.test(e.where)) e.why = 'online';
    else { var p = find(e.where); if (p) { e.lat = p[1]; e.lon = p[2]; } else { e.why = 'unknown'; if (window.console) console.warn('Events globe: no coordinates for "' + e.where + '". Add data-lat and data-lon to that event, or a row to PLACES in globe/events-globe.js.'); } }
    if (e.lat !== null) el.classList.add('ev-located');
    return e;
  });
  var located = events.filter(function (e) { return e.lat !== null; });

  /* ---- group events that are close together into one dot ---- */
  function km(a, b) { var r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lon - a.lon) * r; var h = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) * Math.sin(dn / 2); return 12742 * Math.asin(Math.sqrt(h)); }
  var groups = [];
  located.forEach(function (e) {
    var g = groups.filter(function (g) { return km(g, e) < 30; })[0];
    if (!g) { g = { lat: e.lat, lon: e.lon, evs: [] }; groups.push(g); }
    g.evs.push(e); e.group = g;
    g.lat = g.evs.reduce(function (s, x) { return s + x.lat; }, 0) / g.evs.length; g.lon = g.evs.reduce(function (s, x) { return s + x.lon; }, 0) / g.evs.length;
  });
  function visible(e) { return e.el.style.display !== 'none'; }
  function visEvs(g) { return g.evs.filter(visible); }
  function colourOf(g) { var v = visEvs(g); var k = v.some(function (e) { return e.kind === 'talk'; }) ? 'talk' : v.some(function (e) { return e.kind === 'seminar'; }) ? 'seminar' : 'conf'; return KIND_COLOUR[k]; }

  /* ---- globe geometry ---- */
  var D2R = Math.PI / 180, ctx = cv.getContext('2d');
  var rings = window.EVENTS_GLOBE_WORLD.map(function (r) {
    var n = r.length / 2, xyz = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) { var lo = r[2 * i] / 100 * D2R, la = r[2 * i + 1] / 100 * D2R; xyz[3 * i] = Math.cos(la) * Math.cos(lo); xyz[3 * i + 1] = Math.cos(la) * Math.sin(lo); xyz[3 * i + 2] = Math.sin(la); }
    return { xyz: xyz, n: n, buf: new Float32Array(n * 3) };
  });
  var rot = { lon: -20, lat: 30 }, zoom = 1, W = 0, H = 0, dpr = 1, R = 1, cx = 0, cy = 0;
  var spin = !reduced, onScreen = true, raf = 0, last = 0, anim = null, drag = null, hover = null, pins = [], sel = null;

  function basis() { var l0 = rot.lon * D2R, p0 = rot.lat * D2R; return { e: [-Math.sin(l0), Math.cos(l0), 0], n: [-Math.sin(p0) * Math.cos(l0), -Math.sin(p0) * Math.sin(l0), Math.cos(p0)], c: [Math.cos(p0) * Math.cos(l0), Math.cos(p0) * Math.sin(l0), Math.sin(p0)] }; }
  function xf(B, x, y, z) { return [B.e[0] * x + B.e[1] * y + B.e[2] * z, B.n[0] * x + B.n[1] * y + B.n[2] * z, B.c[0] * x + B.c[1] * y + B.c[2] * z]; }
  function ll(lat, lon) { var la = lat * D2R, lo = lon * D2R; return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]; }
  function sx(x) { return cx + R * x; } function sy(y) { return cy - R * y; }
  function horizon(path, a1, a2) { var d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; var steps = Math.max(2, Math.ceil(Math.abs(d) / 0.15)); for (var k = 1; k < steps; k++) { var a = a1 + d * k / steps; path.push(sx(Math.cos(a)), sy(Math.sin(a))); } }
  function ringPath(B, g) {            // projects one ring, cutting it cleanly at the horizon
    var xyz = g.xyz, n = g.n, buf = g.buf, vis = 0, i;
    for (i = 0; i < n; i++) { var v = xf(B, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2]); buf[3 * i] = v[0]; buf[3 * i + 1] = v[1]; buf[3 * i + 2] = v[2]; if (v[2] > 0) vis++; }
    if (!vis) return null;
    var path = [], exitA = null, firstEntry = null, startVis = buf[2] > 0;
    if (startVis) path.push(sx(buf[0]), sy(buf[1]));
    for (i = 0; i < n - 1; i++) {
      var ax = buf[3 * i], ay = buf[3 * i + 1], az = buf[3 * i + 2], bx = buf[3 * i + 3], by = buf[3 * i + 4], bz = buf[3 * i + 5], va = az > 0, vb = bz > 0;
      if (va && vb) path.push(sx(bx), sy(by));
      else if (va !== vb) {
        var t = az / (az - bz), x = ax + t * (bx - ax), y = ay + t * (by - ay), l = Math.hypot(x, y) || 1; x /= l; y /= l; var ang = Math.atan2(y, x);
        if (va) { path.push(sx(x), sy(y)); exitA = ang; }
        else { if (exitA !== null) horizon(path, exitA, ang); else firstEntry = ang; path.push(sx(x), sy(y), sx(bx), sy(by)); exitA = null; }
      }
    }
    if (!startVis && exitA !== null && firstEntry !== null) horizon(path, exitA, firstEntry);
    return path;
  }

  function draw() {
    if (!W) return;
    R = Math.min(W, H) / 2 * 0.92 * zoom; var B = basis(), i, r;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    var gr = ctx.createRadialGradient(cx - R * .35, cy - R * .4, R * .1, cx, cy, R); gr.addColorStop(0, '#f1f5fb'); gr.addColorStop(1, '#cfdbec');
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fillStyle = gr; ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.clip();
    ctx.strokeStyle = 'rgba(112,0,56,.09)'; ctx.lineWidth = 1; ctx.beginPath();           // graticule
    var lo, la, on, v;
    for (lo = -180; lo < 180; lo += 30) { on = false; for (la = -90; la <= 90; la += 3) { v = xf(B, ll(la, lo)[0], ll(la, lo)[1], ll(la, lo)[2]); if (v[2] > 0) { if (on) ctx.lineTo(sx(v[0]), sy(v[1])); else ctx.moveTo(sx(v[0]), sy(v[1])); on = true; } else on = false; } }
    for (la = -60; la <= 60; la += 30) { on = false; for (lo = -180; lo <= 180; lo += 3) { var p = ll(la, lo); v = xf(B, p[0], p[1], p[2]); if (v[2] > 0) { if (on) ctx.lineTo(sx(v[0]), sy(v[1])); else ctx.moveTo(sx(v[0]), sy(v[1])); on = true; } else on = false; } }
    ctx.stroke();
    ctx.fillStyle = '#fffdfe'; ctx.strokeStyle = '#b99aa9'; ctx.lineWidth = 0.8; ctx.lineJoin = 'round';
    for (i = 0; i < rings.length; i++) { var pa = ringPath(B, rings[i]); if (!pa || pa.length < 6) continue; ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); for (r = 2; r < pa.length; r += 2) ctx.lineTo(pa[r], pa[r + 1]); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.strokeStyle = '#c8aebb'; ctx.lineWidth = 1.5; ctx.stroke();
    // dots
    pins = []; var now = performance.now();
    groups.forEach(function (g) {
      var ve = visEvs(g); if (!ve.length) return;
      var q = ll(g.lat, g.lon), w = xf(B, q[0], q[1], q[2]); if (w[2] <= 0.03) return;
      var x = sx(w[0]), y = sy(w[1]), isSel = sel && sel.group === g, rad = (isSel ? 8 : 6) * Math.min(1.5, 0.85 + zoom * 0.2);
      if (isSel) { var ph = (now % 1500) / 1500; ctx.beginPath(); ctx.arc(x, y, rad + 4 + 6 * ph, 0, 6.2832); ctx.strokeStyle = '#700038'; ctx.globalAlpha = 1 - ph; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1; }
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.2832); ctx.fillStyle = colourOf(g); ctx.fill(); ctx.lineWidth = isSel ? 3 : 1.75; ctx.strokeStyle = '#fff'; ctx.stroke();
      if (ve.length > 1) { ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ve.length, x, y + 0.5); }
      pins.push({ x: x, y: y, r: rad + 5, g: g });
    });
  }

  /* ---- animation loop (runs only while something is moving and the globe is on screen) ---- */
  function needsLoop() { return onScreen && !document.hidden && (anim || (spin && !drag && !hover && !sel) || sel); }
  function frame(t) {
    raf = 0; var dt = Math.min(50, t - (last || t)); last = t;
    if (anim) { var k = Math.min(1, (t - anim.t0) / anim.dur), e = 1 - Math.pow(1 - k, 3); rot.lon = anim.l0 + anim.dl * e; rot.lat = anim.p0 + anim.dp * e; zoom = anim.z0 + (anim.z1 - anim.z0) * e; if (k >= 1) anim = null; }
    else if (spin && !drag && !hover && !sel) rot.lon += dt * 0.006;
    rot.lon = ((rot.lon + 540) % 360) - 180; draw();
    if (needsLoop()) raf = requestAnimationFrame(frame); else last = 0;
  }
  function kick() { if (!raf && needsLoop()) raf = requestAnimationFrame(frame); else if (!raf) draw(); }
  function flyTo(lat, lon, z) {
    var dl = lon - rot.lon; while (dl > 180) dl -= 360; while (dl < -180) dl += 360;
    if (reduced) { rot.lon = lon; rot.lat = Math.max(-70, Math.min(70, lat)); zoom = z; draw(); return; }
    anim = { t0: performance.now(), dur: 800, l0: rot.lon, dl: dl, p0: rot.lat, dp: Math.max(-70, Math.min(70, lat)) - rot.lat, z0: zoom, z1: z }; kick();
  }
  function resize() { var rc = cv.getBoundingClientRect(); dpr = window.devicePixelRatio || 1; W = rc.width; H = rc.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cx = W / 2; cy = H / 2; draw(); }

  /* ---- selecting: highlight in the list, scroll to it, turn the globe ---- */
  var cap = document.getElementById('ev-caption'), live = document.getElementById('ev-live');
  function clearHighlight() { events.forEach(function (e) { e.el.classList.remove('ev-hl'); }); }
  function describe(e) { return e.month + ' ' + e.year + ': ' + e.title + (e.where ? ' (' + e.where + ')' : ''); }
  function setCaption(text, hint) { if (cap) { cap.textContent = text; if (hint) { var s = document.createElement('span'); s.textContent = ' ' + hint; cap.appendChild(s); } } if (live) live.textContent = text; }
  function scrollToEvent(e) {
    var nav = document.getElementById('quarto-header'), bar = document.querySelector('.ev-filter-bar');
    var top = (nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0) + (bar ? bar.offsetHeight : 0), rc = e.el.getBoundingClientRect();   // navbar and sticky filter bar both cover the top
    var y = window.pageYOffset + rc.top - top - Math.max(16, (window.innerHeight - top - rc.height) / 2);
    window.scrollTo({ top: Math.max(0, y), behavior: reduced ? 'auto' : 'smooth' });
  }
  function select(g, which, scroll) {
    var ve = visEvs(g); if (!ve.length) return;
    var same = sel && sel.group === g;
    var idx = which !== undefined ? ve.indexOf(which) : (same ? (sel.idx + 1) % ve.length : 0); if (idx < 0) idx = 0;
    sel = { group: g, idx: idx }; spin = false; syncSpinBtn();
    clearHighlight(); ve.forEach(function (e) { e.el.classList.add('ev-hl'); });
    var e = ve[idx]; e.el.classList.add('ev-focus'); setTimeout(function () { e.el.classList.remove('ev-focus'); }, 1600);
    if (scroll) scrollToEvent(e);
    setCaption(describe(e), ve.length > 1 ? '· ' + ve.length + ' events near here are highlighted; click the dot again for the next.' : '');
    flyTo(g.lat, g.lon, Math.max(zoom, SELECT_ZOOM)); kick();
  }
  function deselect() { if (!sel) return; sel = null; clearHighlight(); setCaption(''); kick(); }

  /* ---- pointer handling ---- */
  var tip = document.getElementById('ev-tip');
  function hit(ev) { var rc = cv.getBoundingClientRect(), x = ev.clientX - rc.left, y = ev.clientY - rc.top, best = null, bd = 1e9; pins.forEach(function (p) { var d = Math.hypot(p.x - x, p.y - y); if (d <= p.r && d < bd) { best = p; bd = d; } }); return best ? { pin: best, x: x, y: y } : null; }
  cv.addEventListener('pointerdown', function (e) { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId }; cv.classList.add('ev-drag'); anim = null; spin = false; syncSpinBtn(); });
  cv.addEventListener('pointermove', function (e) {
    if (drag) { var dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy); rot.lon -= dx * 0.35 / zoom; if (e.pointerType === 'mouse') rot.lat = Math.max(-85, Math.min(85, rot.lat + dy * 0.35 / zoom)); draw(); return; }
    var h = hit(e);
    if (h) {
      hover = h.pin; cv.style.cursor = 'pointer'; while (tip.firstChild) tip.removeChild(tip.firstChild);
      var ve = visEvs(h.pin.g); ve.slice(0, 4).forEach(function (ev) { var d = document.createElement('div'); var b = document.createElement('b'); b.textContent = ev.month + ' ' + ev.year; d.appendChild(b); d.appendChild(document.createTextNode(' · ' + ev.title)); tip.appendChild(d); });
      if (ve.length > 4) { var m = document.createElement('div'); m.textContent = '+' + (ve.length - 4) + ' more'; tip.appendChild(m); }
      var pl = document.createElement('div'); pl.className = 'ev-tip-place'; pl.textContent = ve[0].where; tip.appendChild(pl);
      tip.hidden = false; tip.style.left = Math.min(h.x + 14, W - 220) + 'px'; tip.style.top = Math.max(4, h.y - 12) + 'px';
    } else { hover = null; tip.hidden = true; cv.style.cursor = ''; }
  });
  function endDrag(e) {
    if (!drag) return; var click = drag.moved < 5; drag = null; cv.classList.remove('ev-drag');
    if (click) { var h = hit(e); if (h) select(h.pin.g, undefined, true); else deselect(); } kick();
  }
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', function () { drag = null; cv.classList.remove('ev-drag'); kick(); });
  cv.addEventListener('pointerleave', function () { hover = null; tip.hidden = true; kick(); });
  // keyboard: the list is the accessible way in, but let arrow keys turn a focused globe too
  cv.addEventListener('keydown', function (e) { var d = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] }[e.key]; if (d) { e.preventDefault(); spin = false; syncSpinBtn(); rot.lon += d[0]; rot.lat = Math.max(-85, Math.min(85, rot.lat + d[1])); draw(); } });

  /* ---- clicking an event in the list turns the globe to it (links keep working) ---- */
  events.forEach(function (e) {
    if (e.lat === null) return;
    e.el.addEventListener('click', function (ev) { if (ev.target.closest('a')) return; if (!visible(e)) return; select(e.group, e, false); });
  });

  /* ---- buttons ---- */
  var spinBtn = document.getElementById('ev-spin');
  function syncSpinBtn() { if (spinBtn) { spinBtn.setAttribute('aria-pressed', spin ? 'true' : 'false'); spinBtn.title = spin ? 'Pause rotation' : 'Start rotation'; spinBtn.textContent = spin ? '⏸' : '▶'; } }
  if (spinBtn) spinBtn.addEventListener('click', function () { spin = !spin; syncSpinBtn(); kick(); });
  document.getElementById('ev-zin').addEventListener('click', function () { zoom = Math.min(8, zoom * 1.3); draw(); });
  document.getElementById('ev-zout').addEventListener('click', function () { zoom = Math.max(0.8, zoom / 1.3); draw(); });
  document.getElementById('ev-reset').addEventListener('click', function () { deselect(); flyTo(30, -20, 1); });

  /* ---- keep dots in step with the existing filter buttons ---- */
  document.querySelectorAll('.event-filter button').forEach(function (b) {
    b.addEventListener('click', function () {      // the page's own handler (earlier in the file) has already run
      if (sel && !visEvs(sel.group).length) deselect(); else if (sel) { var ve = visEvs(sel.group); clearHighlight(); ve.forEach(function (e) { e.el.classList.add('ev-hl'); }); }
      kick(); draw();
    });
  });

  /* ---- visibility and start-up ---- */
  layout.classList.add('ev-js');
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { onScreen = en[0].isIntersecting; kick(); }).observe(cv);
  document.addEventListener('visibilitychange', kick);
  if ('ResizeObserver' in window) new ResizeObserver(function () { resize(); }).observe(cv); else window.addEventListener('resize', resize);
  syncSpinBtn(); resize(); kick();
})();
