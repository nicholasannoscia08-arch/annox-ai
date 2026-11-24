var NX = window.NX || {};
NX.pin = function () { return "demo"; };
NX.sessione = function () {
  var s = localStorage.getItem("annox_sess");
  if (!s) {
    s = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("annox_sess", s);
  }
  return s;
};
NX.chiama = async function (percorso, opzioni) {
  opzioni = opzioni || {};
  opzioni.headers = Object.assign({ "X-Pin": NX.pin(), "X-Sess": NX.sessione() }, opzioni.headers || {});
  var r = await fetch(percorso, opzioni);
  if (r.status === 401) {
    localStorage.removeItem("jarvis_pin");
    throw new Error("PIN errato. Ricarica la pagina e riprova.");
  }
  if (r.status === 403 || r.status === 429) {
    var e = await r.json().catch(function () { return {}; });
    throw new Error(e.detail || "Accesso non consentito.");
  }
  return r.json();
};
NX.invio = function (testo) {
  return NX.chiama("/chiedi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ testo: testo })
  });
};
NX.toast = function (messaggio, tipo) {
  var t = document.createElement("div");
  t.className = "toast" + (tipo ? " " + tipo : "");
  t.textContent = messaggio;
  document.getElementById("toasts").appendChild(t);
  setTimeout(function () { t.remove(); }, 3800);
};
