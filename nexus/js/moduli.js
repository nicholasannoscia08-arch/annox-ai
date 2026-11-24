(function () {
  var $ = function (i) { return document.getElementById(i); };
  var main = document.querySelector("main.main"), chat = $("chat");
  var ST = { idle: "In attesa", listening: "In ascolto", thinking: "Elaborazione", responding: "Risposta", error: "Errore" };
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x) e.textContent = x; return e; }
  function btn(x, c) { var b = el("button", c || "pill", x); b.type = "button"; return b; }
  function campo(ph) { var i = el("input", "campo"); i.type = "text"; i.placeholder = ph; i.autocomplete = "off"; return i; }
  function sez(id, titolo) {
    var s = el("section", "vista"); s.id = "v-" + id;
    var v = el("div", "vetro mod"); v.appendChild(el("div", "titolo", titolo));
    s.appendChild(v); main.appendChild(s); return v;
  }
  function errore(e) { NX.toast(e.message, "err"); }

  /* ---------- Voice Studio ---------- */
  var v = sez("voce", "Voice Studio"), c = el("div", "vcentro");
  var mg = btn("", "micg"); mg.title = "Parla con ANNOX";
  mg.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  var vst = el("div", "vst", ST.idle), on = el("div", "vonde");
  for (var k = 0; k < 28; k++) on.appendChild(document.createElement("i"));
  var vs = btn("Ferma voce");
  c.appendChild(mg); c.appendChild(vst); c.appendChild(on); c.appendChild(vs); v.appendChild(c);
  v.appendChild(el("div", "titolo", "Cronologia vocale"));
  var vh = el("div"); vh.appendChild(el("div", "vuoto", "Le conversazioni vocali compariranno qui."));
  v.appendChild(vh);
  mg.addEventListener("click", function () { $("mic").click(); });
  vs.addEventListener("click", function () { $("stop").click(); });
  function storia(u, r) {
    var vuoto = vh.querySelector(".vuoto"); if (vuoto) vuoto.remove();
    var d = el("div", "vitem"), a = el("div"), b = el("div");
    a.appendChild(el("b", "", "Tu")); a.appendChild(document.createTextNode(u));
    b.appendChild(el("b", "", "ANNOX")); b.appendChild(document.createTextNode(r));
    d.appendChild(a); d.appendChild(b); vh.insertBefore(d, vh.firstChild);
    while (vh.children.length > 20) vh.lastChild.remove();
  }
  var eraVoce = false, orig = NX.setCore;
  NX.setCore = function (s) {
    document.body.dataset.st = s; vst.textContent = ST[s] || s;
    if (s === "listening") eraVoce = true;
    else if (s === "responding" && eraVoce) {
      eraVoce = false;
      var u = chat.querySelectorAll(".m.tu"), j = chat.querySelectorAll(".m.j");
      storia(u.length ? u[u.length - 1].textContent : "", j.length ? j[j.length - 1].textContent : "");
    } else if (s === "idle" || s === "error") eraVoce = false;
    orig(s);
  };

  /* ---------- Memory Center ---------- */
  var m = sez("mem", "Memory Center"), fatti = [];
  var mf = el("form", "riga"), mi = campo("Scrivi qualcosa da fargli ricordare…"), mb = btn("Ricorda"), md = btn("Dimentica tutto");
  mb.type = "submit"; mf.appendChild(mi); mf.appendChild(mb); mf.appendChild(md); m.appendChild(mf);
  var mc = campo("Cerca nei ricordi…"), mg2 = el("div", "griglia2"); m.appendChild(mc); m.appendChild(mg2);
  function mostra() {
    mg2.textContent = ""; var q = mc.value.toLowerCase();
    var l = fatti.filter(function (f) { return f.toLowerCase().indexOf(q) > -1; });
    if (!l.length) mg2.appendChild(el("div", "vuoto", fatti.length ? "Nessun risultato." : "Non ho ancora annotato nulla. Scrivi qui sopra qualcosa da ricordare."));
    l.forEach(function (f) { mg2.appendChild(el("div", "fatto", f)); });
  }
  async function ricordi() {
    try {
      var d = await NX.invio("cosa ricordi");
      fatti = (d.risposta || "").split("\n").filter(function (r) { return r.indexOf("- ") === 0; }).map(function (r) { return r.slice(2); });
      mostra();
    } catch (e) { errore(e); }
  }
  mc.addEventListener("input", mostra);
  mf.addEventListener("submit", async function (e) {
    e.preventDefault(); var t = mi.value.trim(); if (!t) return; mi.value = "";
    try { await NX.invio("ricorda " + t); NX.toast("Annotato."); } catch (x) { errore(x); }
    ricordi();
  });
  md.addEventListener("click", async function () {
    if (!confirm("Vuoi davvero cancellare tutta la memoria di ANNOX?")) return;
    try { await NX.invio("dimentica tutto"); chat.textContent = ""; NX.toast("Memoria cancellata."); } catch (x) { errore(x); }
    ricordi();
  });

  /* ---------- Web Explorer ---------- */
  var w = sez("web", "Web Explorer");
  var wf = el("form", "riga"), wi = campo("Cosa vuoi cercare sul web?"), wb = btn("Cerca"), wr = el("div", "wris");
  wb.type = "submit"; wf.appendChild(wi); wf.appendChild(wb); w.appendChild(wf); w.appendChild(wr);
  wr.appendChild(el("span", "vuoto", "Scrivi una ricerca: l’agente cerca sul web e risponde indicando le fonti."));
  function linkifica(box, testo) {
    box.textContent = "";
    var re = /(https?:\/\/[^\s)\]]+)/g, p = 0, mm;
    while ((mm = re.exec(testo))) {
      box.appendChild(document.createTextNode(testo.slice(p, mm.index)));
      var a = el("a", "", mm[1]); a.href = mm[1]; a.target = "_blank"; a.rel = "noopener";
      box.appendChild(a); p = mm.index + mm[1].length;
    }
    box.appendChild(document.createTextNode(testo.slice(p)));
  }
  wf.addEventListener("submit", async function (e) {
    e.preventDefault(); var q = wi.value.trim(); if (!q) return;
    wr.textContent = "Sto cercando sul web…"; NX.setCore("thinking"); wb.disabled = true;
    var ko = false;
    try {
      var d = await NX.invio("Cerca sul web e rispondi in italiano in modo chiaro, indicando le fonti con i link: " + q);
      linkifica(wr, d.risposta); ko = /^Errore|limite gratuito/.test(d.risposta);
    } catch (x) { wr.textContent = x.message; ko = true; }
    wb.disabled = false; NX.setCore(ko ? "error" : "responding");
    setTimeout(function () { NX.setCore("idle"); }, 2000);
  });

  /* ---------- Impostazioni ---------- */
  var im = sez("imp", "Impostazioni");
  function riga(testo) { var r = el("div", "imp"); r.appendChild(el("span", "", testo)); im.appendChild(r); return r; }
  var rt = riga("Tema colore");
  function costruisciTemi() {
    if (rt.dataset.fatto) return; rt.dataset.fatto = "1";
    Array.prototype.forEach.call($("temi").children, function (b) {
      var s = el("button", "sw"); s.type = "button"; s.style.background = b.style.background;
      s.addEventListener("click", function () { b.click(); }); rt.appendChild(s);
    });
  }
  var rc = riga("Riduci le animazioni"), ck = document.createElement("input"); ck.type = "checkbox";
  try { ck.checked = localStorage.getItem("annox_calmo") === "1"; } catch (e) {}
  function calmo() { document.documentElement.classList.toggle("calmo", ck.checked); try { localStorage.setItem("annox_calmo", ck.checked ? "1" : "0"); } catch (e) {} }
  ck.addEventListener("change", calmo); calmo(); rc.appendChild(ck);
  var rs = riga("Sicurezza: dimentica il PIN su questo dispositivo"), bs = btn("Esci");
  bs.addEventListener("click", function () { localStorage.removeItem("jarvis_pin"); location.reload(); }); rs.appendChild(bs);

  NX.aperta = function (id) {
    if (id === "file" && NX.apriFile) NX.apriFile();
    if (id === "mem") ricordi();
    if (id === "imp") costruisciTemi();
  };
})();
