(function () {
  var $ = function (i) { return document.getElementById(i); };
  var chat = $("chat"), st = "idle";
  var orig = NX.setCore;
  NX.setCore = function (s) { st = s; document.body.dataset.st = s; orig(s); };
  function sott() {
    if (st === "idle") return;
    var j = chat.querySelectorAll(".m.j");
    if (j.length) $("sott").textContent = j[j.length - 1].textContent;
  }
  new MutationObserver(sott).observe(chat, { childList: true, subtree: true, characterData: true });
  $("qf").addEventListener("submit", function (e) {
    e.preventDefault(); var v = $("qtesto").value.trim(); if (!v) return;
    $("qtesto").value = ""; $("testo").value = v;
    $("modulo").dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  });
  $("qmic").addEventListener("click", function () { $("mic").click(); });
  document.body.dataset.st = "idle";
})();
