/**
 * Web Copilot — service worker.
 *
 * Guarda a persona ativa (fonte única para todas as abas e iframes), monta o
 * menu de contexto, trata os atalhos de teclado e injeta o content script sob
 * demanda em abas que já estavam abertas antes da instalação — é isso que
 * elimina o velho "recarregue a página para funcionar".
 */
importScripts(
  "scripts/wc-core.js",
  "scripts/wc-datasets.js",
  "scripts/wc-docs.js",
  "scripts/wc-persona.js",
  "scripts/wc-values.js"
);

var CONTENT_FILES = [
  "scripts/wc-core.js",
  "scripts/wc-datasets.js",
  "scripts/wc-docs.js",
  "scripts/wc-persona.js",
  "scripts/wc-values.js",
  "scripts/wc-detect.js",
  "scripts/wc-fill.js",
  "scripts/wc-hud.js",
  "webcopilot.js"
];

// -----------------------------------------------------------------------
// Persona compartilhada
// -----------------------------------------------------------------------

async function personaOptions() {
  var settings = await chrome.storage.sync.get(["WC_seed", "WC_locale", "WC_min_age", "WC_max_age"]);
  return {
    seed: settings.WC_seed || null,
    locale: settings.WC_locale || "BR",
    minAge: Number(settings.WC_min_age) || 18,
    maxAge: Number(settings.WC_max_age) || 70
  };
}

async function getPersona(forceNew) {
  var stored = await chrome.storage.local.get(["WC_persona", "WC_persona_locked"]);
  if (!forceNew && stored.WC_persona) return stored.WC_persona;
  // Persona travada: o usuário quer repetir exatamente o mesmo cadastro.
  if (stored.WC_persona_locked && stored.WC_persona) return stored.WC_persona;

  var options = await personaOptions();
  var persona = self.WC.buildPersona(options);
  await chrome.storage.local.set({ WC_persona: persona });
  await pushHistory(persona);
  return persona;
}

/** Histórico das últimas personas — útil para reabrir um caso que quebrou. */
async function pushHistory(persona) {
  var stored = await chrome.storage.local.get(["WC_history"]);
  var history = stored.WC_history || [];
  history.unshift({
    at: persona.meta.createdAt,
    seed: persona.meta.seed,
    label: persona.label,
    fullName: persona.fullName,
    cpf: persona.cpf,
    email: persona.email,
    persona: persona
  });
  await chrome.storage.local.set({ WC_history: history.slice(0, 20) });
}

async function broadcastPersona(persona) {
  var tabs = await chrome.tabs.query({});
  tabs.forEach(function (tab) {
    if (!tab.id) return;
    chrome.tabs.sendMessage(tab.id, { type: "WC_PERSONA_UPDATED", persona: persona }).catch(function () {});
  });
}

// -----------------------------------------------------------------------
// Injeção sob demanda
// -----------------------------------------------------------------------

async function ensureInjected(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "WC_PING" });
    return true;
  } catch (e) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tabId, allFrames: true }, files: CONTENT_FILES });
      return true;
    } catch (injectError) {
      // chrome://, Web Store e PDFs não aceitam injeção — nada a fazer.
      return false;
    }
  }
}

async function sendToTab(tabId, message) {
  var ready = await ensureInjected(tabId);
  if (!ready) return { ok: false, reason: "página não permite extensões" };
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (e) {
    return { ok: false, reason: "sem resposta da página" };
  }
}

async function activeTabId() {
  var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ? tabs[0].id : null;
}

// -----------------------------------------------------------------------
// Menu de contexto
// -----------------------------------------------------------------------

function buildMenus() {
  chrome.contextMenus.removeAll(function () {
    chrome.contextMenus.create({ id: "wc-fill", title: "Preencher formulário", contexts: ["all"] });
    chrome.contextMenus.create({ id: "wc-new", title: "Nova persona e preencher", contexts: ["all"] });
    chrome.contextMenus.create({ id: "wc-undo", title: "Desfazer preenchimento", contexts: ["all"] });
    chrome.contextMenus.create({ id: "wc-sep", type: "separator", contexts: ["editable"] });

    chrome.contextMenus.create({ id: "wc-one", title: "Preencher este campo com…", contexts: ["editable"] });
    chrome.contextMenus.create({ id: "wc-teach", title: "Ensinar: este campo é…", contexts: ["editable"] });

    self.WC.values.catalog.forEach(function (group, index) {
      var oneGroup = "wc-one-g" + index;
      var teachGroup = "wc-teach-g" + index;
      chrome.contextMenus.create({ id: oneGroup, parentId: "wc-one", title: group.group, contexts: ["editable"] });
      chrome.contextMenus.create({ id: teachGroup, parentId: "wc-teach", title: group.group, contexts: ["editable"] });

      group.types.forEach(function (type) {
        var title = self.WC.values.label(type);
        chrome.contextMenus.create({ id: "wc-one:" + type, parentId: oneGroup, title: title, contexts: ["editable"] });
        chrome.contextMenus.create({ id: "wc-teach:" + type, parentId: teachGroup, title: title, contexts: ["editable"] });
      });
    });
  });
}

chrome.runtime.onInstalled.addListener(function () {
  buildMenus();
  // Semeia os padrões só na primeira instalação, sem sobrescrever escolhas.
  chrome.storage.sync.get(null, function (items) {
    var defaults = {};
    if (items.WC_autocomplete === undefined) defaults.WC_autocomplete = false;
    if (items.WC_show_suggestions === undefined) defaults.WC_show_suggestions = true;
    if (items.WC_show_labels === undefined) defaults.WC_show_labels = true;
    if (items.WC_highlight === undefined) defaults.WC_highlight = true;
    if (items.WC_hud === undefined) defaults.WC_hud = true;
    if (items.WC_mode === undefined) defaults.WC_mode = "valid";
    if (items.WC_locale === undefined) defaults.WC_locale = "BR";
    if (items.WC_fill_unknown_selects === undefined) defaults.WC_fill_unknown_selects = true;
    if (Object.keys(defaults).length) chrome.storage.sync.set(defaults);
  });
});

chrome.contextMenus.onClicked.addListener(async function (info, tab) {
  if (!tab || !tab.id) return;
  var id = String(info.menuItemId);

  if (id === "wc-fill") return void (await sendToTab(tab.id, { type: "WC_FILL_NOW" }));
  if (id === "wc-undo") return void (await sendToTab(tab.id, { type: "WC_UNDO" }));
  if (id === "wc-new") {
    var persona = await getPersona(true);
    await broadcastPersona(persona);
    return void (await sendToTab(tab.id, { type: "WC_NEW_PERSONA_FILL" }));
  }
  if (id.indexOf("wc-one:") === 0) {
    return void (await sendToTab(tab.id, { type: "WC_FILL_FIELD", fieldType: id.slice(7) }));
  }
  if (id.indexOf("wc-teach:") === 0) {
    return void (await sendToTab(tab.id, { type: "WC_TEACH", fieldType: id.slice(9) }));
  }
});

// -----------------------------------------------------------------------
// Atalhos de teclado
// -----------------------------------------------------------------------

chrome.commands.onCommand.addListener(async function (command) {
  var tabId = await activeTabId();
  if (!tabId) return;

  if (command === "fill-now") await sendToTab(tabId, { type: "WC_FILL_NOW" });
  if (command === "undo-fill") await sendToTab(tabId, { type: "WC_UNDO" });
  if (command === "new-persona") {
    var persona = await getPersona(true);
    await broadcastPersona(persona);
    await sendToTab(tabId, { type: "WC_NEW_PERSONA_FILL" });
  }
});

// -----------------------------------------------------------------------
// Mensagens do content script e do popup
// -----------------------------------------------------------------------

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || !message.type) return;

  if (message.type === "WC_GET_PERSONA") {
    getPersona(false).then(function (persona) { sendResponse({ persona: persona }); });
    return true;
  }

  if (message.type === "WC_NEW_PERSONA") {
    getPersona(true).then(function (persona) {
      broadcastPersona(persona);
      sendResponse({ persona: persona });
    });
    return true;
  }

  if (message.type === "WC_FRAME_STATS") {
    // Um iframe preencheu: repassa para o frame de topo somar no painel.
    if (sender.tab && sender.tab.id) {
      chrome.tabs.sendMessage(sender.tab.id, { type: "WC_FRAME_STATS_IN", stats: message }, { frameId: 0 }).catch(function () {});
    }
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "WC_TAB_SEND") {
    // O popup não fala direto com a aba: passa por aqui para reaproveitar a
    // injeção sob demanda.
    activeTabId().then(async function (tabId) {
      if (!tabId) return sendResponse({ ok: false, reason: "nenhuma aba ativa" });
      sendResponse(await sendToTab(tabId, message.payload));
    });
    return true;
  }
});
