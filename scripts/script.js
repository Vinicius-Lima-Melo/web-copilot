/**
 * Web Copilot — lógica do popup.
 *
 * O popup nunca fala direto com a aba: manda tudo pelo service worker
 * (WC_TAB_SEND), que injeta o content script se ele ainda não estiver lá.
 * É por isso que sumiu o botão "Aplicar alterações": não existe mais motivo
 * para recarregar a página.
 */
(function () {
  "use strict";

  var SYNC_KEYS = [
    "WC_show_suggestions", "WC_show_labels", "WC_highlight", "WC_hud",
    "WC_human_typing", "WC_fill_unknown_selects", "WC_check_unknown_boxes", "WC_fill_hidden",
    "WC_mode", "WC_locale", "WC_seed", "WC_min_age", "WC_max_age"
  ];

  var DEFAULTS = {
    WC_auto_sites: [], WC_show_suggestions: true, WC_show_labels: true, WC_highlight: true,
    WC_hud: true, WC_human_typing: false, WC_fill_unknown_selects: true, WC_check_unknown_boxes: false,
    WC_fill_hidden: false, WC_mode: "valid", WC_locale: "BR", WC_seed: "", WC_min_age: 18, WC_max_age: 70
  };

  var MODE_HINTS = {
    valid: "Documentos com dígito verificador correto — passa em qualquer validação.",
    invalid: "CPF, e-mail e datas quebrados de propósito: confere se a sua validação reprova mesmo.",
    chaos: "XSS, SQL, unicode e strings gigantes para testar sanitização e limites."
  };

  var WC = window.WC;
  var $ = function (id) { return document.getElementById(id); };
  var domain = "";

  // -------------------------------------------------------------------
  // Ponte com a aba ativa
  // -------------------------------------------------------------------

  function toTab(payload) {
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage({ type: "WC_TAB_SEND", payload: payload }, function (response) {
        if (chrome.runtime.lastError) return resolve({ ok: false, reason: chrome.runtime.lastError.message });
        resolve(response || { ok: false, reason: "sem resposta" });
      });
    });
  }

  function status(element, message, kind) {
    element.textContent = message;
    element.className = "status" + (kind ? " " + kind : "");
    if (kind) setTimeout(function () { element.className = "status"; }, 3000);
  }

  // -------------------------------------------------------------------
  // Abas
  // -------------------------------------------------------------------

  document.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
      document.querySelectorAll(".panel").forEach(function (p) { p.classList.remove("active"); });
      tab.classList.add("active");
      $("panel-" + tab.dataset.panel).classList.add("active");
      if (tab.dataset.panel === "persona") renderPersona();
      if (tab.dataset.panel === "settings") renderOverrides();
    });
  });

  // -------------------------------------------------------------------
  // Configurações
  // -------------------------------------------------------------------

  function applySettings(items) {
    SYNC_KEYS.forEach(function (key) {
      var element = $(key);
      if (!element) return;
      var value = items[key] === undefined ? DEFAULTS[key] : items[key];
      if (element.type === "checkbox") element.checked = !!value;
      else element.value = value;
    });

    var mode = items.WC_mode || DEFAULTS.WC_mode;
    document.querySelectorAll("#mode button").forEach(function (button) {
      button.classList.toggle("active", button.dataset.mode === mode);
    });
    $("mode_hint").textContent = MODE_HINTS[mode];
  }

  function wireSettingInputs() {
    SYNC_KEYS.forEach(function (key) {
      var element = $(key);
      if (!element) return;
      // Campos de texto/número usam "change" (ao sair): a semente não pode
      // gerar uma persona nova a cada tecla digitada.
      var event = element.type === "checkbox" ? "change" : element.tagName === "SELECT" ? "change" : "change";
      element.addEventListener(event, function () {
        var value = element.type === "checkbox" ? element.checked
          : element.type === "number" ? Number(element.value)
            : element.value;
        var patch = {};
        patch[key] = value;
        chrome.storage.sync.set(patch);

        // Semente, região e idade mudam quem é a persona: gera uma nova na hora.
        if (["WC_seed", "WC_locale", "WC_min_age", "WC_max_age"].indexOf(key) !== -1) {
          chrome.storage.local.remove("WC_persona", function () {
            chrome.runtime.sendMessage({ type: "WC_NEW_PERSONA" }, renderPersona);
          });
        }
      });
    });

    document.querySelectorAll("#mode button").forEach(function (button) {
      button.addEventListener("click", function () {
        chrome.storage.sync.set({ WC_mode: button.dataset.mode });
        document.querySelectorAll("#mode button").forEach(function (b) { b.classList.remove("active"); });
        button.classList.add("active");
        $("mode_hint").textContent = MODE_HINTS[button.dataset.mode];
      });
    });

    $("WC_persona_locked").addEventListener("change", function (event) {
      chrome.storage.local.set({ WC_persona_locked: event.target.checked });
    });
  }

  // -------------------------------------------------------------------
  // Ações
  // -------------------------------------------------------------------

  $("btn_fill").addEventListener("click", async function () {
    $("btn_fill").disabled = true;
    var response = await toTab({ type: "WC_FILL_NOW" });
    $("btn_fill").disabled = false;

    if (!response.ok) return status($("status"), response.reason || "Abra uma página com formulário", "err");
    var stats = response.stats || {};
    status($("status"), response.count + " campo(s) preenchido(s)" + (stats.unknown ? " · " + stats.unknown + " não reconhecido(s)" : ""), "ok");
    renderUnknown(stats.unknownFields || []);
  });

  $("btn_new").addEventListener("click", async function () {
    var response = await toTab({ type: "WC_NEW_PERSONA_FILL" });
    if (!response.ok) return status($("status"), response.reason || "Abra uma página com formulário", "err");
    status($("status"), "Nova persona · " + response.count + " campo(s)", "ok");
    renderUnknown((response.stats || {}).unknownFields || []);
    renderPersona();
  });

  $("btn_undo").addEventListener("click", async function () {
    var response = await toTab({ type: "WC_UNDO" });
    status($("status"), response.ok ? response.count + " campo(s) restaurado(s)" : "Nada para desfazer", response.ok ? "ok" : "err");
  });

  $("btn_clear").addEventListener("click", async function () {
    var response = await toTab({ type: "WC_CLEAR" });
    status($("status"), response.ok ? response.count + " marca(s) removida(s)" : "Nada para limpar", "ok");
  });

  $("btn_new_persona").addEventListener("click", function () {
    chrome.storage.local.set({ WC_persona_locked: false }, function () {
      chrome.runtime.sendMessage({ type: "WC_NEW_PERSONA" }, function () {
        $("WC_persona_locked").checked = false;
        renderPersona();
        status($("persona_status"), "Persona gerada", "ok");
      });
    });
  });

  $("btn_copy_json").addEventListener("click", function () {
    chrome.storage.local.get(["WC_persona"], function (items) {
      if (!items.WC_persona) return;
      navigator.clipboard.writeText(JSON.stringify(items.WC_persona, null, 2)).then(function () {
        status($("persona_status"), "JSON copiado", "ok");
      });
    });
  });

  $("btn_shortcuts").addEventListener("click", function () {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  });

  // -------------------------------------------------------------------
  // Persona
  // -------------------------------------------------------------------

  var PERSONA_ROWS = [
    ["CPF", function (p) { return p.cpf; }],
    ["CNPJ", function (p) { return p.cnpj; }],
    ["RG", function (p) { return p.rg; }],
    ["Nascimento", function (p) { return p.birthDateBR + " (" + p.age + " anos)"; }],
    ["E-mail", function (p) { return p.email; }],
    ["Senha", function (p) { return p.password; }],
    ["Celular", function (p) { return p.phone; }],
    ["Endereço", function (p) { return p.address.street + ", " + p.address.number; }],
    ["Bairro", function (p) { return p.address.neighborhood; }],
    ["Cidade/UF", function (p) { return p.address.city + "/" + p.address.state; }],
    ["CEP", function (p) { return p.address.zip; }],
    ["Mãe", function (p) { return p.motherName; }],
    ["Cartão", function (p) { return p.card.brand + " " + p.card.number; }],
    ["CVV/Val.", function (p) { return p.card.cvv + " · " + p.card.expiry; }],
    ["PIX", function (p) { return p.bank.pixKey; }],
    ["Banco", function (p) { return p.bank.name + " ag " + p.bank.agency + " cc " + p.bank.account; }],
    ["Empresa", function (p) { return p.company.name; }],
    ["Cargo", function (p) { return p.company.jobTitle; }],
    ["CNH", function (p) { return p.cnh + " (" + p.cnhCategory + ")"; }],
    ["PIS", function (p) { return p.pis; }],
    ["Cartão SUS", function (p) { return p.cns; }],
    ["Veículo", function (p) { return p.vehicle.model + " " + p.vehicle.plate; }]
  ];

  function renderPersona() {
    chrome.storage.local.get(["WC_persona", "WC_persona_locked", "WC_history"], function (items) {
      var persona = items.WC_persona;
      $("WC_persona_locked").checked = !!items.WC_persona_locked;
      renderHistory(items.WC_history || []);
      if (!persona) return;

      $("p_name").textContent = persona.fullName;
      $("p_sub").textContent = persona.genderLabel + " · " + persona.age + " anos · " +
        persona.address.city + "/" + persona.address.state +
        (persona.meta.seed ? " · semente " + persona.meta.seed : "");

      var container = $("p_fields");
      container.innerHTML = "";
      PERSONA_ROWS.forEach(function (row) {
        var value;
        try {
          value = row[1](persona);
        } catch (e) {
          return;
        }
        if (!value) return;

        var line = document.createElement("div");
        line.className = "field";
        line.title = "Clique para copiar";

        var key = document.createElement("b");
        key.textContent = row[0];
        var text = document.createElement("span");
        text.textContent = value;

        line.appendChild(key);
        line.appendChild(text);
        line.addEventListener("click", function () {
          navigator.clipboard.writeText(value).then(function () {
            status($("persona_status"), row[0] + " copiado", "ok");
          });
        });
        container.appendChild(line);
      });
    });
  }

  function renderHistory(history) {
    var container = $("history_list");
    container.innerHTML = "";
    if (!history.length) {
      container.innerHTML = '<div class="empty">Nenhuma ainda.</div>';
      return;
    }

    history.slice(0, 8).forEach(function (entry) {
      var item = document.createElement("div");
      item.className = "item";

      var label = document.createElement("span");
      label.textContent = entry.fullName + " · " + entry.cpf;
      item.appendChild(label);

      var reuse = document.createElement("button");
      reuse.textContent = "↺";
      reuse.title = "Voltar a usar esta persona";
      reuse.addEventListener("click", function () {
        chrome.storage.local.set({ WC_persona: entry.persona }, function () {
          renderPersona();
          status($("persona_status"), "Persona restaurada", "ok");
        });
      });
      item.appendChild(reuse);
      container.appendChild(item);
    });
  }

  // -------------------------------------------------------------------
  // Diagnóstico e ensinamentos
  // -------------------------------------------------------------------

  function renderUnknown(fields) {
    var container = $("unknown_list");
    container.innerHTML = "";
    if (!fields.length) {
      container.innerHTML = '<div class="empty">Nenhum campo ficou de fora. 🎯</div>';
      return;
    }

    fields.slice(0, 12).forEach(function (field) {
      var item = document.createElement("div");
      item.className = "item";

      var label = document.createElement("span");
      label.textContent = field.label;
      label.title = field.selector;

      var tag = document.createElement("code");
      tag.textContent = field.tag;

      item.appendChild(label);
      item.appendChild(tag);
      container.appendChild(item);
    });

    var hint = document.createElement("div");
    hint.className = "empty";
    hint.textContent = "Botão direito no campo › Ensinar: este campo é…";
    container.appendChild(hint);
  }

  function renderOverrides() {
    chrome.storage.local.get(["WC_overrides"], function (items) {
      var all = items.WC_overrides || {};
      var forDomain = all[domain] || {};
      var container = $("overrides_list");
      var selectors = Object.keys(forDomain);
      container.innerHTML = "";

      if (!selectors.length) {
        container.innerHTML = '<div class="empty">Nenhum. Clique com o botão direito num campo para ensinar.</div>';
        return;
      }

      selectors.forEach(function (selector) {
        var item = document.createElement("div");
        item.className = "item";

        var label = document.createElement("span");
        label.textContent = selector;
        label.title = selector;

        var type = document.createElement("code");
        type.textContent = window.WC ? window.WC.values.label(forDomain[selector]) : forDomain[selector];

        var remove = document.createElement("button");
        remove.textContent = "×";
        remove.title = "Esquecer";
        remove.addEventListener("click", function () {
          delete all[domain][selector];
          chrome.storage.local.set({ WC_overrides: all }, renderOverrides);
        });

        item.appendChild(label);
        item.appendChild(type);
        item.appendChild(remove);
        container.appendChild(item);
      });
    });
  }

  // -------------------------------------------------------------------
  // Autocompletar deste site
  //
  // O antigo toggle era global e valia para o navegador inteiro — foi o que
  // fez a extensão escrever no compositor do WhatsApp. Agora é por site, e o
  // padrão é desligado em todos. Ver scripts/wc-sites.js.
  // -------------------------------------------------------------------

  function renderAutoSite() {
    var toggle = $("WC_auto_site");
    var nota = $("auto_site_note");
    if (!toggle || !nota) return;

    if (!domain) {
      toggle.checked = false;
      toggle.disabled = true;
      nota.textContent = "Nenhuma página aberta para liberar.";
      return;
    }

    if (WC.sites.isBlocked(domain)) {
      toggle.checked = false;
      toggle.disabled = true;
      nota.innerHTML = "<b>" + escapeHtml(domain) + "</b> é um app de mensagem ou rede social — " +
        "o automático fica sempre desligado aqui. O atalho manual continua funcionando.";
      nota.className = "hint hint-block";
      return;
    }

    chrome.storage.sync.get(["WC_auto_sites"], function (items) {
      var lista = items.WC_auto_sites || [];
      var ligado = WC.sites.canAutofill(domain, lista);
      toggle.disabled = false;
      toggle.checked = ligado;
      nota.className = "hint";
      nota.innerHTML = ligado
        ? "Ligado para <b>" + escapeHtml(WC.sites.suggestPattern(domain)) + "</b> e seus subdomínios."
        : "Desligado. Em <b>" + escapeHtml(domain) + "</b> só preenche quando você pedir.";
    });
  }

  function wireAutoSite() {
    var toggle = $("WC_auto_site");
    if (!toggle) return;
    toggle.addEventListener("change", function () {
      chrome.storage.sync.get(["WC_auto_sites"], function (items) {
        var lista = items.WC_auto_sites || [];
        var nova = toggle.checked ? WC.sites.addSite(lista, domain) : WC.sites.removeSite(lista, domain);
        chrome.storage.sync.set({ WC_auto_sites: nova }, renderAutoSite);
      });
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // -------------------------------------------------------------------
  // Início
  // -------------------------------------------------------------------

  chrome.storage.sync.get(null, function (items) {
    applySettings(items || {});
    wireSettingInputs();
  });

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0] && tabs[0].url) {
      try {
        domain = new URL(tabs[0].url).hostname;
      } catch (e) { /* about:blank e afins */ }
    }
    wireAutoSite();
    renderAutoSite();
    renderOverrides();
    // Mostra o resultado do último preenchimento desta aba, se houver.
    toTab({ type: "WC_REPORT" }).then(function (response) {
      if (response && response.ok && response.stats) renderUnknown(response.stats.unknownFields || []);
    });
  });

  renderPersona();
})();
