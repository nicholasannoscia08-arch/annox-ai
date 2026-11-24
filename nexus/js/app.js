(function () {
  var $ = function (i) { return document.getElementById(i); };
  var SEZ = [
    ["dash", "Dashboard", "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z", 1],
    ["chat", "AI Chat", "M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", 1],
    ["file", "Documenti", "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5", document.getElementById("v-file") ? 1 : 0],
    ["voce", "Voice Studio", "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3", 1],
    ["mem", "Memory Center", "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6", 1],
    ["web", "Web Explorer", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18", 1],
    ["imp", "Impostazioni", "M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M6 15v4", 1]
  ].filter(function (s) { return s[3]; });
  var VISTE = { dash: "v-dash", chat: "v-chat", file: "v-file", voce: "v-voce", mem: "v-mem", web: "v-web", imp: "v-imp" };
  var busy = false, timer = null, caricato = false;
  var mic = $("mic"), chat = $("chat");

  /* ---------- menu ---------- */
  SEZ.forEach(function (s) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "nav" + (s[3] ? "" : " off") + (s[0] === "dash" ? " on" : "");
    b.dataset.id = s[0];
    b.innerHTML = '<svg viewBox="0 0 24 24"><path d="' + s[2] + '"/></svg><span></span>' + (s[3] ? "" : '<em class="bd">presto</em>');
    b.querySelector("span").textContent = s[1];
    b.title = s[1];
    b.addEventListener("click", function () {
      if (!s[3]) { NX.toast(s[1] + ": modulo in arrivo nelle prossime fasi."); return; }
      vai(s[0], s[1]);
    });
    $("menu").appendChild(b);
  });
  function vai(id, nome) {
    document.querySelectorAll(".nav").forEach(function (n) { n.classList.toggle("on", n.dataset.id === id); });
    document.querySelectorAll(".vista").forEach(function (v) { v.classList.remove("on"); });
    $(VISTE[id]).classList.add("on");
    $("sezione").textContent = nome || id; if (NX.aperta) NX.aperta(id);
    NX.ridimCore();
  }
  $("inizia").addEventListener("click", function () { vai("chat", "AI Chat"); $("testo").focus(); });
  $("riduci").addEventListener("click", function () { $("shell").classList.toggle("stretta"); setTimeout(NX.ridimCore, 350); });

  /* ---------- orologio e temi ---------- */
  function orologio() {
    var d = new Date();
    $("ora").textContent = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    $("data").textContent = d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  }
  orologio(); setInterval(orologio, 10000);
  var TEMI = [["70,140,255", "60,220,255", "150,100,255", "170,215,255"], ["40,200,150", "60,240,190", "40,140,220", "190,255,235"], ["255,150,60", "255,200,90", "255,90,120", "255,225,190"], ["170,100,255", "210,150,255", "80,120,255", "225,205,255"]];
  function tema(i) {
    var t = TEMI[i], r = document.documentElement.style;
    r.setProperty("--b", t[0]); r.setProperty("--c", t[1]); r.setProperty("--v", t[2]);
    NX.colore = t[0]; NX.chiaro = t[3];
    try { localStorage.setItem("nexus_tema", i); } catch (e) {}
  }
  TEMI.forEach(function (t, i) {
    var b = document.createElement("button"); b.type = "button"; b.title = "Tema";
    b.style.background = "rgb(" + t[0] + ")"; b.onclick = function () { tema(i); };
    $("temi").appendChild(b);
  });
  try { var ts = localStorage.getItem("nexus_tema"); if (ts !== null) tema(+ts); } catch (e) {}

  /* ---------- monitor attività ---------- */
  function evento(msg, tipo) {
    var v = $("log").querySelector(".vuoto"); if (v) v.remove();
    var li = document.createElement("li"); li.className = tipo || "";
    li.innerHTML = "<i></i><span></span><time></time>";
    li.children[1].textContent = msg;
    li.children[2].textContent = new Date().toLocaleTimeString("it-IT");
    $("log").prepend(li);
    while ($("log").children.length > 40) $("log").lastChild.remove();
  }
  var vuoto = document.createElement("li"); vuoto.className = "vuoto";
  vuoto.textContent = "Nessuna attività: scrivi o parla con l'agente per iniziare.";
  $("log").appendChild(vuoto);

  /* ---------- chat ---------- */
  function aggiungi(chi, testo) {
    var d = document.createElement("div");
    d.className = "m " + (chi === "user" ? "tu" : "j");
    d.textContent = testo; chat.appendChild(d); chat.scrollTop = chat.scrollHeight; return d;
  }
  function stato(core, testo) { NX.setCore(core); $("cs").textContent = testo; document.body.classList.toggle("ascolta", core === "listening"); }
  function fineStato(ms) { clearTimeout(timer); timer = setTimeout(function () { stato("idle", "Pronto"); }, ms); }
  function occ(si) { busy = si; $("invia").disabled = si; mic.disabled = si; }
  function esito(risposta, t0) {
    var s = ((Date.now() - t0) / 1000).toFixed(1);
    if (/^Errore|limite gratuito/.test(risposta)) { evento(risposta.slice(0, 70), "err"); NX.toast(risposta.slice(0, 90), "err"); stato("error", "Errore"); fineStato(2500); }
    else { $("ct").textContent = s + " s"; evento("Risposta generata in " + s + " s"); stato("responding", "Risposta"); fineStato(Math.min(6000, risposta.length * 40)); }
  }

  async function chiedi(testo) {
    if (busy) return;
    occ(true); evento("Richiesta ricevuta"); aggiungi("user", testo);
    stato("thinking", "Elaborazione"); evento("Elaborazione avviata");
    var att = aggiungi("assistant", "…"), t0 = Date.now();
    try { var d = await NX.invio(testo); att.textContent = d.risposta; esito(d.risposta, t0); }
    catch (e) { att.textContent = e.message; evento(e.message, "err"); NX.toast(e.message, "err"); stato("error", "Errore"); fineStato(2500); }
    occ(false);
  }
  $("modulo").addEventListener("submit", function (e) {
    e.preventDefault(); var t = $("testo").value.trim(); if (!t) return; $("testo").value = ""; chiedi(t);
  });

  mic.addEventListener("click", async function () {
    if (busy) return;
    occ(true); evento("Ascolto avviato"); stato("listening", "In ascolto");
    var att = aggiungi("assistant", "Ti ascolto… parla pure."), t0 = Date.now();
    try {
      var d = await NX.chiama("/ascolta", { method: "POST" });
      if (d.errore) { att.textContent = d.errore; evento(d.errore, "err"); NX.toast(d.errore, "err"); stato("error", "Errore"); fineStato(2500); }
      else if (!d.testo) { att.textContent = d.risposta; evento("Nessuna voce rilevata"); stato("idle", "Pronto"); }
      else { att.remove(); evento("Trascrizione completata"); aggiungi("user", d.testo); aggiungi("assistant", d.risposta); esito(d.risposta, t0); }
    } catch (e) { att.textContent = e.message; evento(e.message, "err"); NX.toast(e.message, "err"); stato("error", "Errore"); fineStato(2500); }
    occ(false);
  });
  $("stop").addEventListener("click", function () {
    stato("idle", "Pronto"); evento("Voce interrotta");
    NX.chiama("/silenzio", { method: "POST" }).catch(function () {});
  });

  /* ---------- stato del server ---------- */
  async function ping() {
    try {
      var s = await NX.chiama("/storico");
      $("led").className = "on"; $("stt").textContent = "ONLINE";
      if (!caricato) {
        caricato = true;
        s.forEach(function (m) { aggiungi(m.ruolo, m.testo); });
        if (!s.length) aggiungi("assistant", "Buongiorno. Sono a tua disposizione.");
        evento("Connessione al server stabilita");
      }
    } catch (e) {
      $("led").className = "off"; $("stt").textContent = /PIN/.test(e.message) ? "PIN ERRATO" : "OFFLINE";
    }
  }
  ping(); setInterval(ping, 30000);
})();
