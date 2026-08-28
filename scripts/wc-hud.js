/**
 * Web Copilot — painel flutuante na própria página.
 *
 * Fica em Shadow DOM para o CSS do site não vazar para dentro dele (e
 * vice-versa) e é marcado com data-wc-ui para a coleta de campos ignorar.
 */
(function (root) {
  "use strict";

  var WC = (root.WC = root.WC || {});

  var host = null;
  var shadow = null;
  var refs = {};
  var handlers = {};
  var collapsed = false;

  var CSS = [
    ":host{all:initial}",
    "*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}",
    ".wrap{position:fixed;right:16px;bottom:16px;z-index:2147483647;color:#26262b}",
    ".card{width:272px;background:#fff;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.22),0 0 0 1px rgba(0,0,0,.06);overflow:hidden;animation:pop .16s ease}",
    "@keyframes pop{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}",
    ".head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #eee;cursor:default}",
    ".dot{width:8px;height:8px;border-radius:50%;background:var(--accent,#f6c231);flex:none}",
    ".head h2{font-size:12px;font-weight:700;margin:0;letter-spacing:.2px;flex:1}",
    ".mode{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:2px 6px;border-radius:20px;background:#eef1f5;color:#5a6472}",
    ".mode.invalid{background:#fff1e6;color:#b45309}",
    ".mode.chaos{background:#fde8e8;color:#b91c1c}",
    ".x{border:0;background:none;cursor:pointer;font-size:15px;line-height:1;color:#adadb6;padding:2px 0 2px 4px}",
    ".x:hover{color:#66666e}",
    ".body{padding:10px 12px}",
    ".persona{font-size:12px;line-height:1.45;margin-bottom:9px}",
    ".persona b{display:block;font-size:13px;margin-bottom:1px}",
    ".persona span{color:#71717a;display:block;font-variant-numeric:tabular-nums}",
    ".stats{display:flex;gap:6px;margin-bottom:9px}",
    ".stat{flex:1;background:#f6f7f9;border-radius:8px;padding:6px 8px;text-align:center}",
    ".stat b{display:block;font-size:15px;line-height:1.1}",
    ".stat span{font-size:9px;color:#8b8b93;text-transform:uppercase;letter-spacing:.3px}",
    ".stat.warn b{color:#b45309}",
    ".actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}",
    "button.act{border:1px solid #e4e4e9;background:#fff;border-radius:8px;padding:7px 6px;font-size:11px;font-weight:600;cursor:pointer;color:#3f3f46;display:flex;align-items:center;justify-content:center;gap:4px}",
    "button.act:hover{background:#f7f7f9;border-color:#d6d6dd}",
    "button.act.primary{grid-column:1/-1;background:var(--accent,#f6c231);border-color:transparent;color:#3a2e00;font-size:12px;padding:9px}",
    "button.act.primary:hover{filter:brightness(1.05)}",
    ".toast{margin-top:8px;font-size:11px;color:#3f8f5f;min-height:14px}",
    ".pill{width:38px;height:38px;border-radius:50%;background:var(--accent,#f6c231);border:0;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.24);display:flex;align-items:center;justify-content:center;font-size:17px}",
    "@media (prefers-color-scheme:dark){",
    ".card{background:#232329;box-shadow:0 8px 32px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.08)}",
    ".head{border-bottom-color:#33333b}.wrap{color:#e6e6ea}.persona span{color:#9c9ca6}",
    ".stat{background:#2c2c34}.stat span{color:#9c9ca6}",
    "button.act{background:#2c2c34;border-color:#3a3a44;color:#e6e6ea}button.act:hover{background:#35353f}",
    ".mode{background:#33333b;color:#b6b6c0}}"
  ].join("");

  function html() {
    return (
      '<div class="wrap" part="wrap">' +
      '<div class="card" id="card">' +
      '<div class="head"><span class="dot"></span><h2>Web Copilot</h2><span class="mode" id="mode">válido</span><button class="x" id="close" title="Recolher">&#10005;</button></div>' +
      '<div class="body">' +
      '<div class="persona"><b id="pName">—</b><span id="pDoc"></span><span id="pMail"></span></div>' +
      '<div class="stats">' +
      '<div class="stat"><b id="sFilled">0</b><span>preenchidos</span></div>' +
      '<div class="stat warn"><b id="sUnknown">0</b><span>não achados</span></div>' +
      '<div class="stat"><b id="sFields">0</b><span>campos</span></div>' +
      "</div>" +
      '<div class="actions">' +
      '<button class="act primary" id="fill">Preencher de novo</button>' +
      '<button class="act" id="persona">Nova persona</button>' +
      '<button class="act" id="undo">Desfazer</button>' +
      '<button class="act" id="copy">Copiar dados</button>' +
      '<button class="act" id="clear">Limpar marcas</button>' +
      "</div>" +
      '<div class="toast" id="toast"></div>' +
      "</div></div></div>"
    );
  }

  function build(accent) {
    host = document.createElement("div");
    host.setAttribute("data-wc-ui", "1");
    host.style.cssText = "all:initial;position:static";
    shadow = host.attachShadow({ mode: "open" });

    var style = document.createElement("style");
    style.textContent = CSS;
    shadow.appendChild(style);

    var container = document.createElement("div");
    container.innerHTML = html();
    shadow.appendChild(container);
    (document.body || document.documentElement).appendChild(host);

    shadow.host.style.setProperty("--accent", accent);
    container.querySelector(".wrap").style.setProperty("--accent", accent);

    refs = {
      root: container,
      wrap: container.querySelector(".wrap"),
      card: shadow.getElementById("card"),
      name: shadow.getElementById("pName"),
      doc: shadow.getElementById("pDoc"),
      mail: shadow.getElementById("pMail"),
      filled: shadow.getElementById("sFilled"),
      unknown: shadow.getElementById("sUnknown"),
      fields: shadow.getElementById("sFields"),
      mode: shadow.getElementById("mode"),
      toast: shadow.getElementById("toast")
    };

    bind("fill", "fill");
    bind("persona", "newPersona");
    bind("undo", "undo");
    bind("copy", "copy");
    bind("clear", "clear");
    shadow.getElementById("close").addEventListener("click", collapse);
  }

  function bind(id, action) {
    shadow.getElementById(id).addEventListener("click", function () {
      if (handlers[action]) handlers[action]();
    });
  }

  function collapse() {
    collapsed = true;
    refs.wrap.innerHTML = "";
    var pill = document.createElement("button");
    pill.className = "pill";
    pill.title = "Web Copilot";
    pill.textContent = "⚡";
    pill.addEventListener("click", function () {
      destroy();
      collapsed = false;
      if (handlers.expand) handlers.expand();
    });
    refs.wrap.appendChild(pill);
  }

  function destroy() {
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null;
    shadow = null;
    refs = {};
  }

  function show(state) {
    if (!host) build(state.accent || "#f6c231");
    if (collapsed) return;

    var persona = state.persona || {};
    refs.name.textContent = persona.fullName || "—";
    refs.doc.textContent = persona.cpf ? persona.cpf + "  ·  " + (persona.phone || "") : "";
    refs.mail.textContent = persona.email || "";
    refs.filled.textContent = state.filled || 0;
    refs.unknown.textContent = state.unknown || 0;
    refs.fields.textContent = state.fields || 0;
    refs.mode.textContent = state.mode === "invalid" ? "inválido" : state.mode === "chaos" ? "caos" : "válido";
    refs.mode.className = "mode" + (state.mode && state.mode !== "valid" ? " " + state.mode : "");
  }

  function toast(message) {
    if (!refs.toast) return;
    refs.toast.textContent = message;
    setTimeout(function () {
      if (refs.toast) refs.toast.textContent = "";
    }, 2600);
  }

  WC.hud = {
    show: show,
    toast: toast,
    destroy: destroy,
    isOpen: function () { return !!host; },
    on: function (map) { handlers = Object.assign(handlers, map); }
  };
})(typeof window !== "undefined" ? window : globalThis);
