/**
 * Web Copilot — página de testes.
 *
 * Este arquivo existe separado do HTML por causa da CSP do Manifest V3:
 * `script-src 'self'` bloqueia <script> inline em páginas servidas pela
 * própria extensão (chrome-extension://). Como arquivo externo, o mesmo
 * código roda tanto ao abrir o tester por file:// quanto pelo botão da
 * página de boas-vindas.
 *
 * Contém: (1) o campo dentro de shadow DOM, (2) a verificação automática
 * de ?selftest=1 — usada por tests/run.sh — e (3) o modo demonstração,
 * para quando a página está aberta como página da extensão, onde o content
 * script não é injetado.
 */

// --- 1) campo em shadow DOM ---------------------------------------
// Campo dentro de shadow DOM: web components escondem os inputs do
// querySelectorAll comum.
(function () {
    var host = document.getElementById("shadow-host");
    var shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML =
        '<style>.f{display:flex;flex-direction:column;gap:4px;max-width:260px}' +
        'label{font:600 12px system-ui;color:#55555e}' +
        'input{border:1px solid #ccccd4;border-radius:7px;padding:8px 10px;font-size:13px}</style>' +
        '<div class="f"><label for="s1">CPF (dentro do shadow DOM)</label><input id="s1" name="cpfShadow"></div>';
})();

// --- 2) verificação automática (?selftest=1) ----------------------
(function () {
    if (!/[?&]selftest=1/.test(location.search)) return;
    var files = ["wc-core", "wc-datasets", "wc-docs", "wc-persona", "wc-values", "wc-detect", "wc-fill"];
    var pending = files.length;
    files.forEach(function (name, index) {
        var tag = document.createElement("script");
        tag.src = "scripts/" + name + ".js";
        tag.async = false;
        tag.onload = function () { if (--pending === 0) runSelfTest(); };
        document.head.appendChild(tag);
    });

    function runSelfTest() {
        var WC = window.WC;
        var report = document.getElementById("wc-report");
        var persona = WC.buildPersona({ seed: "selftest", locale: "BR" });
        var rnd = new WC.Random("selftest:fill");
        var options = { mode: "valid", fillUnknownSelects: true, checkUnknownBoxes: false, fillHidden: false, humanTyping: false };

        var lines = [];
        var filled = 0, unknown = 0, skipped = 0, considered = 0;
        var unknownList = [];

        WC.dom.collectFields(document).forEach(function (element) {
            if (!WC.dom.isFillable(element, options)) return;
            considered++;

            var attr = element.getAttribute("web-copilot") || element.getAttribute("data-wc-type");
            var aliases = { userName: "fullName", telefone: "phone", documento: "cpfCnpj" };
            var result = attr
                ? { type: aliases[attr] || attr, source: "atributo" }
                : WC.detect.classify(WC.dom.extractSignals(element));

            var name = element.name || element.id || element.getAttribute("data-field") || "(sem nome)";

            if (result.skip) { skipped++; lines.push(pad(name) + "VETADO"); return; }
            if (!result.type) { unknown++; unknownList.push(name); lines.push(pad(name) + "??? não reconhecido"); return; }

            var applied = WC.dom.fillField(element, result.type, persona, rnd, options);
            if (applied === null || applied === undefined) { lines.push(pad(name) + result.type + " -> (não preencheu)"); return; }
            filled++;
            lines.push(pad(name) + result.type + " = " + applied);
        });

        var checks = [
            ["CPF gerado é válido", WC.validate.cpf(persona.cpf)],
            ["CNPJ gerado é válido", WC.validate.cnpj(persona.cnpj)],
            ["campo #cpf recebeu CPF válido", WC.validate.cpf(document.getElementById("cpf").value)],
            ["campo #cnpj recebeu CNPJ válido", WC.validate.cnpj(document.getElementById("cnpj").value)],
            ["campo #cnh recebeu CNH válida", WC.validate.cnh(document.getElementById("cnh").value)],
            ["campo #pis recebeu PIS válido", WC.validate.pis(document.getElementById("pis").value)],
            ["campo #cns recebeu CNS válido", WC.validate.cns(document.getElementById("cns").value)],
            ["campo #titulo recebeu título válido", WC.validate.titulo(document.getElementById("titulo").value)],
            ["campo #renavam recebeu RENAVAM válido", WC.validate.renavam(document.getElementById("renavam").value)],
            ["campo #chassi recebeu chassi válido", WC.validate.chassi(document.getElementById("chassi").value)],
            ["campo #numCartao passa em Luhn", WC.validate.luhn(document.getElementById("numCartao").value)],
            ["campo #boleto tem linha digitável válida", WC.validate.boletoLine(document.getElementById("boleto").value)],
            ["campo #processo é CNJ válido", WC.validate.processoCNJ(document.getElementById("processo").value)],
            ["senha e confirmação batem", document.getElementById("senha").value === document.getElementById("senhaConf").value],
            ["e-mail e confirmação batem", document.getElementById("email").value === document.getElementById("emailConf").value],
            ["UF do select bate com a cidade", document.getElementById("uf").value === persona.address.state],
            ["CEP começa com a região da cidade", document.getElementById("cep").value.indexOf(persona.address.zip.slice(0, 3)) === 0],
            ["DDD do celular bate com a cidade", document.getElementById("celular").value.indexOf(persona.address.areaCode) === 1],
            ["busca foi vetada", document.getElementById("busca").value === ""],
            ["cupom foi vetado", document.getElementById("cupom").value === ""],
            ["honeypot oculto não foi tocado", document.getElementById("hp").value === ""],
            ["readonly preservado", document.getElementById("ro").value === "não mexer"],
            ["termos marcado", document.getElementById("termos").checked === true],
            ["campo com máscara recebeu só dígitos", /^\d+$/.test(document.getElementById("m1").value)],
            ["input type=date recebeu ISO", /^\d{4}-\d{2}-\d{2}$/.test(document.getElementById("nascimento").value)],
            ["input type=number recebeu número puro", /^-?\d+(\.\d+)?$/.test(document.getElementById("idade").value)],
            ["shadow DOM foi preenchido", !!document.getElementById("shadow-host").shadowRoot.getElementById("s1").value],
            ["contenteditable foi preenchido", document.querySelector("[contenteditable]").textContent.length > 0],
            ["um rádio de sexo foi marcado", !!document.querySelector('input[name=sexo]:checked')]
        ];

        var failed = checks.filter(function (c) { return !c[1]; });

        report.className = "on";
        report.textContent =
            "WEB COPILOT SELFTEST\n" +
            "====================\n" +
            "campos considerados: " + considered + " | preenchidos: " + filled +
            " | vetados: " + skipped + " | não reconhecidos: " + unknown + "\n" +
            (unknownList.length ? "sem tipo: " + unknownList.join(", ") + "\n" : "") +
            "\n" + lines.join("\n") +
            "\n\nVERIFICAÇÕES\n" + checks.map(function (c) { return (c[1] ? "  ok  " : "FALHOU ") + c[0]; }).join("\n") +
            "\n\nRESULTADO: " + (failed.length ? "FALHOU (" + failed.length + ")" : "TUDO OK") + "\n";
    }

    function pad(name) {
        var out = String(name);
        while (out.length < 24) out += " ";
        return out + " -> ";
    }
})();

// --- 3) modo demonstração ------------------------------------------------
/**
 * Quando esta página é aberta como página da extensão
 * (`chrome-extension://…/WebCopilot_Tester.html`, que é o que o botão da tela
 * de boas-vindas faz), o preenchimento normal NÃO funciona — e antes disto a
 * pessoa só via a mensagem "página não permite extensões", sem entender por quê.
 *
 * O motivo são duas regras do Chrome, não um bug:
 *   - content scripts declarados com `<all_urls>` não casam com o esquema
 *     `chrome-extension:`, então o script nunca é injetado aqui;
 *   - `chrome.scripting.executeScript` também não alcança páginas da própria
 *     extensão.
 *
 * O motor de preenchimento, porém, é o mesmo `wc-fill.js` que a extensão usa.
 * Então aqui a página carrega os módulos e preenche a si mesma: o resultado é
 * fiel, só não passa pelo caminho de injeção. Fica explícito na faixa que isto
 * é demonstração, e como testar o caminho real.
 */
(function () {
  "use strict";

  if (location.protocol !== "chrome-extension:") return;
  if (/[?&]selftest=1/.test(location.search)) return;

  var MODULOS = ["wc-core", "wc-sites", "wc-datasets", "wc-docs", "wc-persona", "wc-values", "wc-detect", "wc-fill"];

  var faixa = document.createElement("div");
  faixa.setAttribute("role", "status");
  faixa.style.cssText = [
    "position:sticky", "top:0", "z-index:99", "margin:0 0 20px",
    "padding:14px 18px", "border-left:3px solid #ffd904", "background:#fff9db",
    "color:#3f3400", "font:14px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    "border-radius:0 10px 10px 0"
  ].join(";");
  faixa.innerHTML =
    "<b>Modo demonstração.</b> Esta página está aberta como página da extensão, e o Chrome não injeta " +
    "content script em páginas da própria extensão — por isso o atalho e o botão do popup respondem " +
    '"página não permite extensões" aqui. ' +
    '<button id="wc-demo" style="margin:10px 8px 0 0;background:#ffd904;color:#141414;border:0;' +
    'border-radius:8px;padding:9px 16px;font:700 13px inherit;cursor:pointer">Preencher (demonstração)</button>' +
    '<button id="wc-demo-limpar" style="margin-top:10px;background:#fff;color:#3f3400;border:1px solid #e6d9a0;' +
    'border-radius:8px;padding:9px 16px;font:600 13px inherit;cursor:pointer">Limpar</button>' +
    '<div style="margin-top:10px;font-size:12.5px;opacity:.85">Para exercitar o caminho real, abra este ' +
    "arquivo da pasta do projeto (<code>file://…/WebCopilot_Tester.html</code>) com " +
    '<b>“Permitir acesso a URLs de arquivo”</b> ligado em <code>chrome://extensions</code>, ou publique-o ' +
    "em qualquer http(s).</div>";

  document.body.insertBefore(faixa, document.body.firstChild);

  var pendentes = MODULOS.length;
  MODULOS.forEach(function (nome) {
    var tag = document.createElement("script");
    tag.src = "scripts/" + nome + ".js";
    tag.async = false;
    tag.onload = function () { if (--pendentes === 0) ligarBotoes(); };
    document.head.appendChild(tag);
  });

  function ligarBotoes() {
    var WC = window.WC;
    document.getElementById("wc-demo").addEventListener("click", function () {
      var persona = WC.buildPersona({ locale: "BR" });
      var rnd = new WC.Random(null);
      // Mesmas opções do preenchimento real, com a digitação animada ligada —
      // é o comportamento que a extensão tem por padrão.
      var options = {
        mode: "valid", fillUnknownSelects: true, checkUnknownBoxes: false,
        fillHidden: false, humanTyping: true, typingSpeed: 22, typingQueue: []
      };
      var n = 0;
      WC.dom.collectFields(document).forEach(function (el) {
        if (!WC.dom.isFillable(el, options)) return;
        if (faixa.contains(el)) return; // não preencher os controles da própria faixa
        var attr = el.getAttribute("web-copilot") || el.getAttribute("data-wc-type");
        var r = attr ? { type: attr } : WC.detect.classify(WC.dom.extractSignals(el));
        if (r.skip || !r.type) return;
        try {
          if (WC.dom.fillField(el, r.type, persona, rnd, options) !== null) {
            WC.dom.highlight(el, "#ffd904");
            n++;
          }
        } catch (e) { /* campo isolado não deve derrubar a demonstração */ }
      });
      WC.dom.runTypingQueue(options.typingQueue);
      this.textContent = n + " campo(s) — preencher de novo";
    });

    document.getElementById("wc-demo-limpar").addEventListener("click", function () {
      WC.dom.undoAll();
      document.getElementById("wc-demo").textContent = "Preencher (demonstração)";
    });
  }
})();
