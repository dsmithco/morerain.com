/* More Rain — cinematic pixel-art background.
   Renders a low-resolution rainy dusk scene on a tiny canvas that CSS
   scales up with crisp ("pixelated") edges. Static layers (sky, mountains,
   pines) are baked once; rain, fog, stars, the moon glow and a rare distant
   flash animate on top. Honours prefers-reduced-motion. */
(function () {
  var cv = document.getElementById('pixelbg');
  if (!cv || !cv.getContext) return;

  var BW = cv.width, BH = cv.height;            // 240 x 135
  var ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- deterministic RNG so the scene is identical every load --- */
  var seed = 20240607;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function rgb(c) { return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; }
  function mix(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }

  /* --- vertical sky gradient (moody dusk) --- */
  var stops = [
    [0.00, [18, 22, 38]],   // deep night blue
    [0.42, [52, 42, 70]],   // purple
    [0.66, [120, 64, 60]],  // dusk haze
    [0.74, [176, 86, 54]],  // warm horizon glow
    [0.82, [70, 56, 70]],
    [1.00, [22, 18, 28]]
  ];
  function skyAt(y) {
    var t = y / BH, i;
    for (i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i][0] && t <= stops[i + 1][0]) {
        var lt = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
        return mix(stops[i][1], stops[i + 1][1], lt);
      }
    }
    return stops[stops.length - 1][1];
  }

  /* --- a jagged ridge line built from summed sines --- */
  function ridge(base, amp, freq, phase) {
    var h = new Array(BW), x;
    for (x = 0; x < BW; x++) {
      var n = Math.sin(x * freq + phase) * amp
            + Math.sin(x * freq * 2.3 + phase * 1.7) * amp * 0.4
            + Math.sin(x * freq * 0.5 + phase * 0.3) * amp * 0.6;
      h[x] = Math.round(base + n);
    }
    return h;
  }
  function fillRidge(c, h, color) {
    c.fillStyle = rgb(color);
    for (var x = 0; x < BW; x++) c.fillRect(x, h[x], 1, BH - h[x]);
  }

  /* a single pine tree, top at (x,y) drawn downward */
  function pine(c, x, y, hgt, color) {
    c.fillStyle = rgb(color);
    var rows = hgt, w;
    for (var r = 0; r < rows; r++) {
      w = Math.round((r / rows) * (hgt * 0.55)) + 1;
      c.fillRect(x - w, y + r, w * 2 + 1, 1);
    }
    c.fillRect(x - 1, y + rows, 1, 3);           // trunk
  }

  /* --- bake the static backdrop once --- */
  var bg = document.createElement('canvas');
  bg.width = BW; bg.height = BH;
  var bx = bg.getContext('2d');

  (function bake() {
    var y, x;
    for (y = 0; y < BH; y++) { bx.fillStyle = rgb(skyAt(y)); bx.fillRect(0, y, BW, 1); }

    var far  = ridge(74, 9, 0.05, 1.2);
    var mid  = ridge(90, 13, 0.035, 4.0);
    var near = ridge(108, 8, 0.06, 2.4);
    fillRidge(bx, far,  [44, 50, 76]);
    fillRidge(bx, mid,  [30, 32, 52]);
    fillRidge(bx, near, [14, 15, 26]);

    // pines scattered along the near ridge
    for (x = 6; x < BW; x += 9 + Math.floor(rnd() * 6)) {
      var ny = near[x] - 1, hgt = 5 + Math.floor(rnd() * 6);
      pine(bx, x, ny - hgt, hgt, [10, 11, 20]);
    }
  })();

  /* --- dynamic elements --- */
  var stars = [];
  for (var i = 0; i < 46; i++) {
    stars.push({ x: Math.floor(rnd() * BW), y: Math.floor(rnd() * 56), p: rnd() * 6.28, s: 0.6 + rnd() });
  }

  var drops = [];
  for (i = 0; i < 130; i++) {
    drops.push({ x: rnd() * BW, y: rnd() * BH, len: 3 + Math.floor(rnd() * 4), v: 110 + rnd() * 70 });
  }

  var moon = { x: Math.round(BW * 0.72), y: 30, r: 8 };

  var fog = [
    { y: 92,  speed: 4,  amp: 2.0, a: 0.10 },
    { y: 104, speed: 7,  amp: 1.4, a: 0.13 },
    { y: 116, speed: 10, amp: 1.0, a: 0.16 }
  ];

  function drawMoon(c, t) {
    var glow = 0.5 + 0.5 * Math.sin(t * 0.6);
    c.save();
    c.globalAlpha = 0.12 + glow * 0.06;
    c.fillStyle = 'rgb(236,228,205)';
    c.beginPath(); c.arc(moon.x, moon.y, moon.r + 5, 0, 6.2832); c.fill();
    c.globalAlpha = 1;
    c.fillStyle = 'rgb(232,226,206)';
    c.beginPath(); c.arc(moon.x, moon.y, moon.r, 0, 6.2832); c.fill();
    c.fillStyle = 'rgb(208,200,180)';        // a couple of craters
    c.fillRect(moon.x - 3, moon.y - 2, 2, 2);
    c.fillRect(moon.x + 2, moon.y + 1, 2, 2);
    c.restore();
  }

  function drawStars(c, t) {
    for (var k = 0; k < stars.length; k++) {
      var s = stars[k];
      var tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.s + s.p));
      c.globalAlpha = tw;
      c.fillStyle = 'rgb(226,222,205)';
      c.fillRect(s.x, s.y, 1, 1);
    }
    c.globalAlpha = 1;
  }

  function drawFog(c, t) {
    for (var f = 0; f < fog.length; f++) {
      var b = fog[f];
      c.globalAlpha = b.a;
      c.fillStyle = 'rgb(150,150,170)';
      var off = (t * b.speed) % (BW + 40);
      for (var x = -40; x < BW; x += 8) {
        var yy = b.y + Math.round(Math.sin((x + off) * 0.12) * b.amp);
        c.fillRect(((x + off) % (BW + 40)) - 20, yy, 7, 2);
      }
    }
    c.globalAlpha = 1;
  }

  function drawRain(c, dt) {
    c.fillStyle = 'rgb(206,210,222)';
    c.globalAlpha = 0.55;
    for (var d = 0; d < drops.length; d++) {
      var p = drops[d];
      p.y += p.v * dt;
      p.x -= p.v * dt * 0.32;                 // wind slant
      if (p.y > BH) { p.y = -p.len; p.x = rnd() * (BW + 30); }
      if (p.x < -4) p.x = BW + rnd() * 20;
      for (var l = 0; l < p.len; l++) {
        c.fillRect(Math.round(p.x - l * 0.32), Math.round(p.y - l), 1, 1);
      }
    }
    c.globalAlpha = 1;
  }

  /* rare distant lightning flash */
  var flash = 0, nextFlash = 6 + rnd() * 10;

  function frame(c, t, dt) {
    c.clearRect(0, 0, BW, BH);
    c.drawImage(bg, 0, 0);
    drawStars(c, t);
    drawMoon(c, t);
    drawFog(c, t);
    drawRain(c, dt);

    if (!reduce) {
      nextFlash -= dt;
      if (nextFlash <= 0 && flash <= 0) { flash = 0.6; nextFlash = 7 + rnd() * 12; }
      if (flash > 0) {
        c.globalAlpha = Math.min(0.5, flash) * 0.6;
        c.fillStyle = 'rgb(220,226,240)';
        c.fillRect(0, 0, BW, Math.round(BH * 0.6));
        c.globalAlpha = 1;
        flash -= dt * 2.2;
      }
    }
  }

  if (reduce) { frame(ctx, 0, 0); return; }   // single static frame

  var last = null;
  function loop(now) {
    if (last === null) last = now;
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frame(ctx, now / 1000, dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
