(function () {
  var b = document.getElementById("svuota"), chat = document.getElementById("chat");
  if (!b) return;
  b.addEventListener("click", async function () {
    if (!confirm("Vuoi eliminare tutta la cronologia delle conversazioni?\n\nI ricordi salvati e i documenti caricati non verranno cancellati.")) return;
    b.disabled = true;
    try {
      var d = await NX.chiama("/cancella-cronologia", { method: "POST" });
      if (d && d.detail) throw new Error("Funzione non disponibile: riavvia il server (Control + C, poi python server.py).");
      chat.textContent = "";
      var m = document.createElement("div");
      m.className = "m j";
      m.textContent = "Cronologia eliminata. Possiamo ricominciare da zero.";
      chat.appendChild(m);
      NX.toast("Cronologia eliminata.");
    } catch (e) { NX.toast(e.message, "err"); }
    b.disabled = false;
  });
})();
