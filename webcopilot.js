/**
 * Web Copilot — content script principal.
 *
 * Junta as peças: lê as configurações, pega a persona compartilhada do
 * service worker, classifica cada campo da página e preenche. Roda em todos
 * os frames; só o frame de topo desenha o painel.
 */
(function () {
  "use strict";

  if (window.__wcInjected) return;
  window.__wcInjected = true;

  var WC = window.WC;
  var isTopFrame = window.top === window;

  function wcLog(msg, extra) {
    console.log("%c WC > %c" + msg, "color:#f6c231", "color:#c1c1c1", extra !== undefined ? extra : "");
  }

  var DEFAULTS = {
    // `WC_auto_sites` substituiu o antigo booleano global `WC_autocomplete`.
    // Ver scripts/wc-sites.js para o porquê (bug do compositor do WhatsApp).
    WC_auto_sites: [],
    WC_show_suggestions: false,
    WC_show_labels: true,
    WC_highlight: true,
    WC_hud: true,
    WC_mode: "valid",
    WC_human_typing: false,
    WC_fill_unknown_selects: true,
    WC_check_unknown_boxes: false,
    WC_fill_hidden: false
  };

  var settings = Object.assign({}, DEFAULTS);
  var persona = null;
  var overrides = {};
  var observer = null;
  var lastStats = { filled: 0, unknown: 0, fields: 0, details: [], unknownFields: [] };
  var lastContextTarget = null;
  var typeCache = new WeakMap();
  var domain = location.hostname;

  // -------------------------------------------------------------------
  // Cor de destaque: usa a cor do próprio site em vez de uma cor fixa
  // -------------------------------------------------------------------

  var ACCENT_VARS = [
    "--primary", "--primary-color", "--color-primary", "--brand-color", "--brand",
    "--accent-color", "--accent", "--main-color", "--theme-color",
    "--bs-primary", "--mdc-theme-primary", "--ion-color-primary", "--el-color-primary"
  ];

  function colorToRgb(value) {
    var probe = document.createElement("span");
    probe.style.color = "";
    probe.style.color = value;
    if (!probe.style.color) return null;

    document.body.appendChild(probe);
    var computed = getComputedStyle(probe).color;
    document.body.removeChild(probe);

    var m = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!m) return null;
    if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
    return { r: +m[1], g: +m[2], b: +m[3] };
  }

  function isUsableAccent(value) {
    if (!value) return false;
    value = String(value).trim();
    if (!value || ["transparent", "inherit", "initial", "none"].indexOf(value) !== -1) return false;
    var rgb = colorToRgb(value);
    if (!rgb) return false;
    // Perto do branco não dá para enxergar como contorno na maioria dos temas.
    return !(rgb.r > 245 && rgb.g > 245 && rgb.b > 245);
  }

  function findAccentColor() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && isUsableAccent(meta.content)) return meta.content.trim();

    var rootStyle = getComputedStyle(document.documentElement);
    for (var i = 0; i < ACCENT_VARS.length; i++) {
      var value = rootStyle.getPropertyValue(ACCENT_VARS[i]);
      if (isUsableAccent(value)) return value.trim();
    }

    var candidates = document.querySelectorAll('button[type="submit"], input[type="submit"], .btn-primary, .primary, a.button');
    for (var j = 0; j < candidates.length; j++) {
      var bg = getComputedStyle(candidates[j]).backgroundColor;
      if (isUsableAccent(bg)) return bg;
    }
    return "#f6c231";
  }

  function accentColor() {
    if (!window.__wcAccent) window.__wcAccent = findAccentColor();
    return window.__wcAccent;
  }

  // -------------------------------------------------------------------
  // Persona e configurações
  // -------------------------------------------------------------------

  function ask(message) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(message, function (response) {
          if (chrome.runtime.lastError) return resolve(null);
          resolve(response);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  async function ensurePersona(forceNew) {
    if (persona && !forceNew) return persona;
    var response = await ask({ type: forceNew ? "WC_NEW_PERSONA" : "WC_GET_PERSONA" });
    if (response && response.persona) {
      persona = response.persona;
    } else if (!persona) {
      // Service worker indisponível (ex.: página aberta antes da instalação):
      // gera localmente para não deixar o usuário na mão.
      persona = WC.buildPersona({ locale: settings.WC_locale, seed: settings.WC_seed });
    }
    return persona;
  }

  function loadSettings() {
    return new Promise(function (resolve) {
      chrome.storage.sync.get(null, function (items) {
        settings = Object.assign({}, DEFAULTS, items || {});
        chrome.storage.local.get(["WC_overrides"], function (local) {
          overrides = (local && local.WC_overrides && local.WC_overrides[domain]) || {};
          resolve(settings);
        });
      });
    });
  }

  // -------------------------------------------------------------------
  // Classificação com cache e com os "ensinamentos" do domínio
  // -------------------------------------------------------------------

  var LEGACY_ALIASES = {
    userName: "fullName", userNames: "fullName",
    telefone: "phone", telefones: "phone",
    cep: "cep", ceps: "cep",
    cpf: "cpf", cpfs: "cpf",
    documento: "cpfCnpj", documentos: "cpfCnpj",
    email: "email", emails: "email", senha: "password"
  };

  function typeOf(element) {
    if (typeCache.has(element)) return typeCache.get(element);

    var result;
    var attr = element.getAttribute("web-copilot") || element.getAttribute("data-wc-type");
    if (attr) {
      result = { type: LEGACY_ALIASES[attr] || attr, score: 1000, skip: false, source: "atributo" };
    } else {
      var selector = WC.dom.selectorFor(element);
      if (overrides[selector]) {
        result = { type: overrides[selector], score: 999, skip: false, source: "ensinado" };
      } else {
        result = WC.detect.classify(WC.dom.extractSignals(element));
      }
    }

    typeCache.set(element, result);
    return result;
  }

  // -------------------------------------------------------------------
  // Preenchimento
  // -------------------------------------------------------------------

  function fillOptions() {
    return {
      mode: settings.WC_mode,
      humanTyping: settings.WC_human_typing,
      fillUnknownSelects: settings.WC_fill_unknown_selects,
      checkUnknownBoxes: settings.WC_check_unknown_boxes,
      fillHidden: settings.WC_fill_hidden
    };
  }

  async function fillAll(force) {
    await ensurePersona(false);

    var options = fillOptions();
    // Semente derivada da persona: mesma persona => mesmos valores aleatórios
    // (quantidades, selects sorteados) em toda re-execução.
    var rnd = new WC.Random(persona.meta.seed ? persona.meta.seed + ":fill" : null);
    var accent = accentColor();
    var fields = WC.dom.collectFields(document);

    if (force) WC.dom.resetRadioGroups();

    var filled = 0;
    var details = [];
    var unknownFields = [];
    var considered = 0;

    fields.forEach(function (element) {
      if (!WC.dom.isFillable(element, options)) return;
      considered++;

      if (element.getAttribute("data-wc-filled") === "1" && !force) return;

      var result = typeOf(element);
      if (result.skip) return;

      if (!result.type) {
        unknownFields.push({
          selector: WC.dom.selectorFor(element),
          label: (WC.dom.labelText(element) || element.getAttribute("placeholder") || element.getAttribute("name") || element.id || "campo sem rótulo").trim().slice(0, 60),
          tag: element.tagName.toLowerCase()
        });
        return;
      }

      var label = WC.values.label(result.type);
      if (settings.WC_show_suggestions) element.title = "Web Copilot: " + label;

      var applied;
      try {
        applied = WC.dom.fillField(element, result.type, persona, rnd, options);
      } catch (e) {
        wcLog("falha ao preencher campo", e);
        return;
      }
      if (applied === null || applied === undefined) return;

      if (settings.WC_highlight) WC.dom.highlight(element, accent);
      else element.setAttribute("data-wc-filled", "1");

      if (settings.WC_show_labels) {
        var isCheckable = element.type === "checkbox" || element.type === "radio";
        WC.dom.addHint(element, accent, isCheckable ? "Marcado pelo WebCopilot" : "Atualizado pelo WebCopilot");
      }

      filled++;
      details.push({ label: label, type: result.type, value: String(applied).slice(0, 60), source: result.source });
    });

    lastStats = { filled: filled, unknown: unknownFields.length, fields: considered, details: details, unknownFields: unknownFields };

    if (filled) wcLog(filled + " campo(s) preenchido(s)", lastStats);
    if (isTopFrame) renderHud();
    else if (filled) ask({ type: "WC_FRAME_STATS", filled: filled, unknown: unknownFields.length, fields: considered });

    return lastStats;
  }

  function clearMarks() {
    var cleared = 0;
    WC.dom.collectFields(document).forEach(function (element) {
      if (element.getAttribute("data-wc-filled") === "1") {
        WC.dom.clearHighlight(element);
        cleared++;
      }
    });
    document.querySelectorAll("small.wc-hint").forEach(function (n) { n.remove(); });
    return cleared;
  }

  // -------------------------------------------------------------------
  // Painel na página
  // -------------------------------------------------------------------

  function renderHud() {
    if (!isTopFrame || !settings.WC_hud || !WC.hud) return;
    if (!lastStats.filled && !WC.hud.isOpen()) return;

    WC.hud.show({
      accent: accentColor(),
      persona: persona,
      filled: lastStats.filled,
      unknown: lastStats.unknown,
      fields: lastStats.fields,
      mode: settings.WC_mode
    });
  }

  function wireHud() {
    if (!WC.hud) return;
    WC.hud.on({
      fill: async function () {
        var stats = await fillAll(true);
        WC.hud.toast(stats.filled + " campo(s) preenchido(s)");
      },
      newPersona: async function () {
        await ensurePersona(true);
        typeCache = new WeakMap();
        var stats = await fillAll(true);
        WC.hud.toast("Nova persona: " + persona.firstName);
        renderHud();
        return stats;
      },
      undo: function () {
        var restored = WC.dom.undoAll();
        WC.hud.toast(restored + " campo(s) restaurado(s)");
      },
      copy: function () {
        var text = JSON.stringify(persona, null, 2);
        navigator.clipboard.writeText(text).then(
          function () { WC.hud.toast("Persona copiada como JSON"); },
          function () { WC.hud.toast("Não foi possível copiar"); }
        );
      },
      clear: function () {
        WC.hud.toast(clearMarks() + " marca(s) removida(s)");
      },
      expand: function () {
        renderHud();
      }
    });
  }

  // -------------------------------------------------------------------
  // Observador: formulários que aparecem depois (SPA, wizard, modal)
  // -------------------------------------------------------------------

  function debounce(fn, wait) {
    var timer;
    return function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }

  /** O automático só existe onde o usuário liberou. Ver scripts/wc-sites.js. */
  function autofillPermitido() {
    return WC.sites.canAutofill(domain, settings.WC_auto_sites);
  }

  function startWatching() {
    if (observer) return;
    if (!autofillPermitido()) return;
    fillAll(false);
    observer = new MutationObserver(debounce(function () {
      // Reconfere a cada disparo: o usuário pode ter tirado o site da lista
      // com a aba aberta, e o observer não morre sozinho.
      if (!autofillPermitido()) return stopWatching();
      fillAll(false);
    }, 400));
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function stopWatching() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // -------------------------------------------------------------------
  // Mensagens
  // -------------------------------------------------------------------

  document.addEventListener("contextmenu", function (event) {
    lastContextTarget = event.target;
  }, true);

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!message || !message.type) return;

    switch (message.type) {
      case "WC_PING":
        sendResponse({ ok: true, version: WC.VERSION, top: isTopFrame });
        return;

      case "WC_FILL_NOW":
        loadSettings().then(function () {
          typeCache = new WeakMap();
          return fillAll(true);
        }).then(function (stats) {
          sendResponse({ ok: true, count: stats.filled, stats: stats });
        });
        return true;

      case "WC_NEW_PERSONA_FILL":
        loadSettings().then(function () {
          persona = null;
          typeCache = new WeakMap();
          return ensurePersona(true);
        }).then(function () {
          return fillAll(true);
        }).then(function (stats) {
          sendResponse({ ok: true, count: stats.filled, persona: persona, stats: stats });
        });
        return true;

      case "WC_FRAME_STATS_IN":
        // Um iframe da página preencheu campos: soma no painel do topo.
        lastStats.filled += message.stats.filled || 0;
        lastStats.unknown += message.stats.unknown || 0;
        lastStats.fields += message.stats.fields || 0;
        renderHud();
        return;

      case "WC_PERSONA_UPDATED":
        persona = message.persona;
        renderHud();
        return;

      case "WC_UNDO":
        sendResponse({ ok: true, count: WC.dom.undoAll() });
        return;

      case "WC_CLEAR":
        sendResponse({ ok: true, count: clearMarks() });
        return;

      case "WC_REPORT":
        sendResponse({ ok: true, stats: lastStats, persona: persona, top: isTopFrame });
        return;

      case "WC_FILL_FIELD":
        // Vem do menu de contexto: preenche só o campo clicado.
        (async function () {
          if (!lastContextTarget) return sendResponse({ ok: false });
          await ensurePersona(false);
          var rnd = new WC.Random(null);
          var applied = WC.dom.fillField(lastContextTarget, message.fieldType, persona, rnd, fillOptions());
          if (applied !== null && applied !== undefined && settings.WC_highlight) {
            WC.dom.highlight(lastContextTarget, accentColor());
          }
          sendResponse({ ok: applied !== null, value: applied });
        })();
        return true;

      case "WC_TEACH":
        if (!lastContextTarget) {
          sendResponse({ ok: false });
          return;
        }
        var selector = WC.dom.selectorFor(lastContextTarget);
        chrome.storage.local.get(["WC_overrides"], function (local) {
          var all = (local && local.WC_overrides) || {};
          all[domain] = all[domain] || {};
          all[domain][selector] = message.fieldType;
          chrome.storage.local.set({ WC_overrides: all }, function () {
            overrides = all[domain];
            typeCache = new WeakMap();
            sendResponse({ ok: true, selector: selector });
          });
        });
        return true;

      default:
        return;
    }
  });

  // Configuração mudou no popup: aplica na hora, sem recarregar a página.
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === "sync") {
      Object.keys(changes).forEach(function (key) { settings[key] = changes[key].newValue; });
      if (changes.WC_auto_sites) {
        if (autofillPermitido()) startWatching();
        else stopWatching();
      }
      if (changes.WC_hud && !settings.WC_hud && WC.hud) WC.hud.destroy();
      if (changes.WC_mode || changes.WC_locale || changes.WC_seed) typeCache = new WeakMap();
    }
    if (area === "local" && changes.WC_overrides) {
      overrides = (changes.WC_overrides.newValue || {})[domain] || {};
      typeCache = new WeakMap();
    }
  });

  // -------------------------------------------------------------------
  // Início
  // -------------------------------------------------------------------

  wireHud();
  loadSettings().then(function () {
    wcLog("webcopilot " + WC.VERSION + " pronto", { autocompletarAqui: autofillPermitido(), modo: settings.WC_mode });
    if (autofillPermitido()) startWatching();
  });
})();
