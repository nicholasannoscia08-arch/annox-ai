(function () {
  NX.chiama("/ruolo").then(function (d) {
    if (d && d.ruolo === "ospite") {
      document.body.classList.add("ospite");
      NX.toast("Modalità ospite: puoi chattare con l’agente.");
    }
  }).catch(function () {});
})();
