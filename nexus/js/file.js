(function () {
  var $ = function (i) { return document.getElementById(i); };
  var sel = null, attivo = null;
  function dim(n) { return n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(0) + " KB" : (n / 1048576).toFixed(1) + " MB"; }
  async function api(percorso, opz) {
    var d = await NX.chiama(percorso, opz);
    if (d && d.detail) throw new Error("Funzione non disponibile: riavvia il server (Control + C, poi python server.py).");
    return d;
  }
  function el(tag, cls, testo) { var e = document.createElement(tag); if (cls) e.className = cls; if (testo) e.textContent = testo; return e; }

  function disegna(docs) {
    var ul = $("flista"); ul.textContent = "";
    if (!docs.length) { ul.appendChild(el("li", "vuoto", $("fcerca").value ? "Nessun risultato." : "Nessun documento: trascina un file qui sopra.")); return; }
    docs.forEach(function (d) {
      var li = el("li", sel && sel.id === d.id ? "sel" : ""), nm = el("div");
      nm.appendChild(el("b", "", d.nome)); nm.appendChild(el("small", "", dim(d.dimensione) + " · " + d.data));
      li.appendChild(el("span", "tp", d.tipo)); li.appendChild(nm); li.appendChild(el("i", "pt2" + (attivo === d.id ? " on" : "")));
      li.addEventListener("click", function () { seleziona(d); });
      ul.appendChild(li);
    });
  }
  async function carica() {
    var q = $("fcerca").value.trim();
    try {
      var d = await api("/api/documenti" + (q ? "?q=" + encodeURIComponent(q) : ""));
      attivo = d.attivo; disegna(d.documenti);
    } catch (e) { NX.toast(e.message, "err"); }
  }
  function chip(nome) {
    var c = $("fchip"); c.hidden = false; c.textContent = "";
    var x = el("button", "", "✕"); x.type = "button"; x.title = "L’agente smette di usarlo";
    x.addEventListener("click", async function () { try { await api("/api/documenti/disattiva", { method: "POST" }); } catch (e) {} attivo = null; c.hidden = true; carica(); });
    c.appendChild(el("span", "", "L’agente sta usando: " + nome)); c.appendChild(x);
  }
  async function seleziona(d) {
    sel = d; $("ftit").textContent = d.nome; $("frisp").textContent = "";
    var box = $("fanteprima"); box.textContent = "Carico l’anteprima…";
    try {
      await api("/api/documenti/" + d.id + "/usa", { method: "POST" });
      attivo = d.id; chip(d.nome);
      if (d.tipo === "pdf") {
        var r = await fetch("/api/documenti/" + d.id + "/file", { headers: { "X-Pin": NX.pin() } });
        var f = document.createElement("iframe"); f.src = URL.createObjectURL(await r.blob());
        box.textContent = ""; box.appendChild(f);
      } else {
        var t = await api("/api/documenti/" + d.id + "/anteprima");
        box.textContent = t.testo + (t.caratteri > 4000 ? "\n\n[…]" : "");
      }
      carica();
    } catch (e) { box.textContent = e.message; }
  }
  async function chiedi(testo) {
    if (!sel) { NX.toast("Seleziona prima un documento."); return; }
    var r = $("frisp"); r.textContent = "Sto leggendo il documento…"; NX.setCore("thinking");
    var errore = false;
    try {
      var d = await NX.invio(testo); r.textContent = d.risposta; errore = /^Errore|limite gratuito/.test(d.risposta);
    } catch (e) { r.textContent = e.message; errore = true; }
    NX.setCore(errore ? "error" : "responding");
    setTimeout(function () { NX.setCore("idle"); }, 2000);
  }
  async function caricaFile(files) {
    for (var i = 0; i < files.length; i++) {
      var fd = new FormData(); fd.append("file", files[i]);
      try {
        var d = await api("/api/documenti", { method: "POST", body: fd });
        if (d.errore) NX.toast(files[i].name + ": " + d.errore, "err"); else NX.toast("Caricato: " + files[i].name);
      } catch (e) { NX.toast(e.message, "err"); }
    }
    carica();
  }

  var z = $("zona");
  ["dragenter", "dragover"].forEach(function (n) { z.addEventListener(n, function (e) { e.preventDefault(); z.classList.add("sopra"); }); });
  ["dragleave", "drop"].forEach(function (n) { z.addEventListener(n, function (e) { e.preventDefault(); z.classList.remove("sopra"); }); });
  z.addEventListener("drop", function (e) { caricaFile(Array.prototype.slice.call(e.dataTransfer.files)); });
  $("fscegli").addEventListener("click", function () { $("finput").click(); });
  $("finput").addEventListener("change", function () { var fl = Array.prototype.slice.call($("finput").files); $("finput").value = ""; caricaFile(fl); });
  $("fcerca").addEventListener("input", carica);
  $("friass").addEventListener("click", function () { chiedi("Riassumi in modo chiaro e ordinato il documento allegato."); });
  $("fform").addEventListener("submit", function (e) {
    e.preventDefault(); var v = $("fdom").value.trim(); if (!v) return; $("fdom").value = "";
    chiedi("Rispondendo in base al documento allegato: " + v);
  });
  $("fscarica").addEventListener("click", async function () {
    if (!sel) return;
    try {
      var r = await fetch("/api/documenti/" + sel.id + "/file", { headers: { "X-Pin": NX.pin() } });
      var a = document.createElement("a"); a.href = URL.createObjectURL(await r.blob()); a.download = sel.nome; a.click();
    } catch (e) { NX.toast(e.message, "err"); }
  });
  $("felimina").addEventListener("click", async function () {
    if (!sel || !confirm("Eliminare «" + sel.nome + "» in modo definitivo?")) return;
    try {
      await api("/api/documenti/" + sel.id, { method: "DELETE" });
      NX.toast("Documento eliminato."); sel = null; $("ftit").textContent = "Documento";
      $("fanteprima").textContent = "Seleziona un documento dall’elenco."; $("fchip").hidden = true; $("frisp").textContent = ""; carica();
    } catch (e) { NX.toast(e.message, "err"); }
  });
  NX.apriFile = carica;
})();
