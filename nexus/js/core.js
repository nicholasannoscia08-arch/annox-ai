(function () {
  var cv = document.getElementById("core"), g = cv.getContext("2d");
  var W = 0, H = 0, ang = 0, fr = 0, st = "idle", pul = [], pts = [], lin = [];
  var calmo = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  NX.colore = "70,140,255";
  NX.chiaro = "170,215,255";
  var VEL = { idle: .003, listening: .008, thinking: .03, responding: .012, error: .002 };
  var AMP = { idle: .02, listening: .03, thinking: .015, responding: .07, error: .02 };
  var FRQ = { idle: .03, listening: .08, thinking: .12, responding: .2, error: .5 };

  for (var i = 0, N = 700; i < N; i++) {
    var y = 1 - 2 * (i + .5) / N, r = Math.sqrt(1 - y * y), ph = i * 2.399963;
    pts.push([Math.cos(ph) * r, y, Math.sin(ph) * r, i % 11 === 0]);
  }
  function sfer(a, b) { a *= Math.PI / 180; b *= Math.PI / 180; return [Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b)]; }
  for (var m = 0; m < 12; m++) { var l = []; for (var t = -90; t <= 90; t += 10) l.push(sfer(t, m * 30)); lin.push(l); }
  for (var q = -60; q <= 60; q += 30) { var l2 = []; for (var u = 0; u <= 360; u += 10) l2.push(sfer(q, u)); lin.push(l2); }

  function ridim() {
    var d = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * d; cv.height = H * d;
    g.setTransform(d, 0, 0, d, 0, 0);
  }
  function rot(p, a) {
    var c = Math.cos(a), s = Math.sin(a), k = .35, x = p[0] * c + p[2] * s, z = -p[0] * s + p[2] * c, y = p[1] * Math.cos(k) - z * Math.sin(k);
    return [x, y, p[1] * Math.sin(k) + z * Math.cos(k)];
  }

  function frame() {
    fr++;
    if (W > 0 && H > 0) {
      var cb = st === "error" ? "255,90,100" : NX.colore, cl = st === "error" ? "255,170,175" : NX.chiaro;
      ang += VEL[st] * (calmo ? .2 : 1);
      g.clearRect(0, 0, W, H);
      var sc = calmo ? 1 : 1 + AMP[st] * Math.sin(fr * FRQ[st]);
      var R = Math.min(W, H) * .3 * sc, c0 = W / 2, c1 = H * .5;
      if (st === "error") c0 += (Math.random() - .5) * 4;
      var gl = g.createRadialGradient(c0, c1, 0, c0, c1, R * 1.7);
      gl.addColorStop(0, "rgba(" + cb + ",.28)"); gl.addColorStop(1, "rgba(" + cb + ",0)");
      g.fillStyle = gl; g.fillRect(0, 0, W, H);
      var bd = g.createRadialGradient(c0 - R * .3, c1 - R * .3, R * .1, c0, c1, R);
      bd.addColorStop(0, "rgba(" + cb + ",.32)"); bd.addColorStop(.75, "rgba(8,20,60,.45)"); bd.addColorStop(1, "rgba(2,6,24,.7)");
      g.fillStyle = bd; g.beginPath(); g.arc(c0, c1, R, 0, 7); g.fill();
      g.strokeStyle = "rgba(" + cl + ",.6)"; g.lineWidth = 1.2; g.shadowColor = "rgb(" + cb + ")"; g.shadowBlur = 14; g.stroke(); g.shadowBlur = 0;
      g.lineWidth = .6; g.strokeStyle = "rgba(" + cl + ",.14)";
      lin.forEach(function (l) {
        g.beginPath(); var pen = false;
        l.forEach(function (p) {
          var r = rot(p, ang);
          if (r[2] > 0) { var X = c0 + r[0] * R, Y = c1 - r[1] * R; if (pen) g.lineTo(X, Y); else { g.moveTo(X, Y); pen = true; } } else pen = false;
        });
        g.stroke();
      });
      pts.forEach(function (p) {
        var r = rot(p, ang); if (r[2] <= 0) return;
        var a = .25 + .65 * r[2], s = p[3] ? 1.8 : 1;
        g.fillStyle = p[3] ? "rgba(255,255,255," + a + ")" : "rgba(" + cl + "," + a * .75 + ")";
        g.fillRect(c0 + r[0] * R - s / 2, c1 - r[1] * R - s / 2, s, s);
      });
      var vr = st === "thinking" ? 4 : 1;
      g.setLineDash([7, 9]); g.lineWidth = 1.1;
      [[.5, 1.5, .7], [1, 1.36, -.5], [1.5, 1.6, .35]].forEach(function (o, k) {
        for (var j = 0; j < 2; j++) {
          g.beginPath(); var pen = false;
          for (var n = 0; n <= 64; n++) {
            var th = n / 64 * Math.PI * 2, cz = Math.cos(o[0]), sz = Math.sin(o[0]);
            var r = rot([Math.cos(th) * cz, Math.cos(th) * sz, Math.sin(th)], ang * o[2] * vr + k);
            if ((r[2] > 0) === (j === 1)) { var X = c0 + r[0] * R * o[1], Y = c1 - r[1] * R * o[1]; if (pen) g.lineTo(X, Y); else { g.moveTo(X, Y); pen = true; } } else pen = false;
          }
          g.strokeStyle = j ? "rgba(" + cl + ",.8)" : "rgba(" + cb + ",.3)"; g.stroke();
        }
      });
      g.setLineDash([]);
      var ogni = st === "listening" ? 40 : st === "responding" ? 25 : 0;
      if (ogni && fr % ogni === 0) pul.push({ r: R * 1.05, a: .7 });
      pul = pul.filter(function (p) {
        p.r += 1.5; p.a -= .008; if (p.a <= 0) return false;
        g.strokeStyle = "rgba(" + cl + "," + p.a + ")"; g.lineWidth = 1.5; g.beginPath(); g.arc(c0, c1, p.r, 0, 7); g.stroke(); return true;
      });
    }
    requestAnimationFrame(frame);
  }
  NX.setCore = function (s) { st = s; };
  NX.ridimCore = ridim;
  window.addEventListener("resize", ridim);
  ridim(); frame();
})();
