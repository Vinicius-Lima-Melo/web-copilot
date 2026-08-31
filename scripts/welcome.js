/**
 * Web Copilot — página de boas-vindas.
 *
 * Script separado do HTML porque a CSP padrão do Manifest V3 bloqueia
 * `<script>` inline em páginas da extensão.
 */
(function () {
  "use strict";

  var botao = document.getElementById("btn_test");
  if (!botao) return;

  botao.addEventListener("click", function () {
    chrome.tabs.create({ url: chrome.runtime.getURL("WebCopilot_Tester.html") });
  });
})();
