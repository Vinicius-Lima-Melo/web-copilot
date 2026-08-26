(function () {
  if (window.__wcInjected) return;
  window.__wcInjected = true;

  wcLog("webcopilot.js");
  wcLog("running...");

  var lastContextTarget = null;
  var observer = null;

  // ---------------------------------------------------------------------
  // Dados de apoio (100% locais, sem dependências externas)
  // ---------------------------------------------------------------------

  var BR_FIRST_NAMES = ["João", "Maria", "José", "Ana", "Pedro", "Paula", "Lucas", "Mariana", "Carlos", "Fernanda", "Rafael", "Juliana", "Bruno", "Camila", "Gabriel", "Beatriz", "Felipe", "Larissa", "Rodrigo", "Amanda"];
  var BR_LAST_NAMES = ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes", "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Barbosa"];
  var BR_DDDS = ["11", "21", "31", "41", "47", "51", "61", "71", "81", "85", "91"];
  var BR_LOCATIONS = [
    { city: "São Paulo", state: "SP" },
    { city: "Rio de Janeiro", state: "RJ" },
    { city: "Belo Horizonte", state: "MG" },
    { city: "Curitiba", state: "PR" },
    { city: "Porto Alegre", state: "RS" },
    { city: "Salvador", state: "BA" },
    { city: "Fortaleza", state: "CE" },
    { city: "Recife", state: "PE" },
    { city: "Brasília", state: "DF" },
    { city: "Manaus", state: "AM" },
    { city: "Goiânia", state: "GO" },
    { city: "Florianópolis", state: "SC" }
  ];
  var COMPANY_SUFFIXES = ["Comércio", "Serviços", "Tecnologia", "Indústria", "Soluções", "Consultoria"];
  var COMPANY_LEGAL = ["LTDA", "ME", "EIRELI", "S.A."];
  var COMPLEMENTS = ["Apto 101", "Casa 2", "Bloco B", "Fundos", "Sala 4", ""];

  // Alias de compatibilidade com o atributo antigo `web-copilot="tipo"`
  var LEGACY_ALIASES = {
    userName: "fullName",
    userNames: "fullName",
    telefone: "phone",
    telefones: "phone",
    cep: "cep",
    ceps: "cep",
    cpf: "cpf",
    cpfs: "cpf",
    documento: "cpfCnpj",
    documentos: "cpfCnpj"
  };

  // Regras de detecção automática por nome/id/placeholder/autocomplete/label/type.
  // Ordem importa: regras mais específicas primeiro. O combo cpf/cnpj precisa vir
  // antes das regras isoladas de cnpj e cpf, senão "CPF/CNPJ" cai sempre em cnpj
  // (a regra /cnpj/ já dá match no final da string "cpf/cnpj").
  var DETECTION_RULES = [
    { type: "email", re: /e-?mail/ },
    { type: "password", re: /senha|password|\bpwd\b/ },
    { type: "cpfCnpj", re: /cpf\s*[\/\-_]?\s*cnpj|cnpj\s*[\/\-_]?\s*cpf|cpf\s+ou\s+cnpj|cnpj\s+ou\s+cpf/ },
    { type: "cnpj", re: /cnpj/ },
    { type: "cpf", re: /\bcpf\b/ },
    { type: "companyName", re: /razao ?social|nome ?fantasia/ },
    { type: "cep", re: /\bcep\b/ },
    { type: "phone", re: /telefone|celular|\bfone\b|whatsapp|\btel\b/ },
    { type: "age", re: /\bidade\b|\bage\b/ },
    { type: "birthday", re: /nascimento|data ?nasc|birthdate|\bdob\b/ },
    { type: "neighborhood", re: /\bbairro\b/ },
    { type: "complement", re: /complemento/ },
    { type: "streetNumber", re: /\bnumero\b|\bnum\b/ },
    { type: "street", re: /endereco|logradouro|\brua\b|\bavenida\b/ },
    { type: "state", re: /\buf\b|\bestado\b/ },
    { type: "city", re: /\bcidade\b|municipio/ },
    { type: "fullName", re: /nome ?completo|full ?name/ },
    { type: "firstName", re: /primeiro ?nome|first ?name|\bfname\b/ },
    { type: "lastName", re: /sobrenome|last ?name|\blname\b/ },
    { type: "name", re: /\bnome\b|\bname\b/ },
    { type: "terms", re: /aceito|concordo|\btermos\b|privacidade/ }
  ];

  var FIELD_LABELS = {
    email: "e-mail de teste",
    password: "senha de teste",
    cpfCnpj: "CPF/CNPJ de teste",
    cnpj: "CNPJ de teste",
    cpf: "CPF de teste",
    companyName: "razão social de teste",
    cep: "CEP de teste",
    phone: "telefone de teste",
    age: "idade de teste",
    birthday: "data de nascimento de teste",
    neighborhood: "bairro de teste",
    complement: "complemento de teste",
    streetNumber: "número de teste",
    street: "endereço de teste",
    state: "estado de teste",
    city: "cidade de teste",
    fullName: "nome completo de teste",
    firstName: "primeiro nome de teste",
    lastName: "sobrenome de teste",
    name: "nome de teste",
    terms: "aceite de termos"
  };

  // ---------------------------------------------------------------------
  // Geradores de dado fake (Chance.js + pequenos geradores locais BR)
  // ---------------------------------------------------------------------

  function pad2(n) {
    return String(n).length < 2 ? "0" + n : String(n);
  }

  function toISODate(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }

  function toBRDate(date) {
    return pad2(date.getDate()) + "/" + pad2(date.getMonth() + 1) + "/" + date.getFullYear();
  }

  function calculateAge(birthDate) {
    var today = new Date();
    var age = today.getFullYear() - birthDate.getFullYear();
    var m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  }

  function generatePhone() {
    var ddd = chance.pickone(BR_DDDS);
    var isMobile = chance.bool();
    if (isMobile) {
      return "(" + ddd + ") 9" + chance.string({ pool: "0123456789", length: 3 }) + "-" + chance.string({ pool: "0123456789", length: 4 });
    }
    var firstDigit = chance.pickone(["2", "3", "4"]);
    return "(" + ddd + ") " + firstDigit + chance.string({ pool: "0123456789", length: 3 }) + "-" + chance.string({ pool: "0123456789", length: 4 });
  }

  function generateCEP() {
    return chance.string({ pool: "0123456789", length: 5 }) + "-" + chance.string({ pool: "0123456789", length: 3 });
  }

  function generatePassword() {
    var upper = chance.character({ pool: "ABCDEFGHJKLMNPQRSTUVWXYZ" });
    var lower = chance.string({ length: 6, pool: "abcdefghjkmnpqrstuvwxyz" });
    var digits = chance.string({ length: 3, pool: "0123456789" });
    var symbol = chance.pickone(["!", "@", "#", "$", "%", "*", "?"]);
    return chance.shuffle((upper + lower + digits + symbol).split("")).join("");
  }

  function generateCompanyName() {
    return chance.capitalize(chance.word({ syllables: 3 })) + " " + chance.pickone(COMPANY_SUFFIXES) + " " + chance.pickone(COMPANY_LEGAL);
  }

  function generateEmail(profile) {
    var local = (profile.firstName + "." + profile.lastName).toLowerCase().replace(/[^a-z.]/g, "");
    // Domínio ".invalid" é reservado por RFC 2606: nunca resolve nem entrega e-mail de
    // verdade, então o preenchimento automático não corre o risco de mandar e-mails
    // de verificação/confirmação para uma caixa real de outra pessoa.
    return local + chance.natural({ min: 1, max: 999 }) + "@webcopilot.invalid";
  }

  function createProfile() {
    var firstName = chance.pickone(BR_FIRST_NAMES);
    var lastName = chance.pickone(BR_LAST_NAMES);
    var birthdayDate = chance.birthday({ type: "adult" });
    return {
      firstName: firstName,
      lastName: lastName,
      fullName: firstName + " " + lastName,
      location: chance.pickone(BR_LOCATIONS),
      birthdayDate: birthdayDate,
      age: calculateAge(birthdayDate)
    };
  }

  // ---------------------------------------------------------------------
  // Compatibilidade com inputs controlados (React/Vue/Angular)
  // ---------------------------------------------------------------------

  // React (e via inputValueTracking) substitui o setter de `value`/`checked` na
  // própria instância do elemento para rastrear mudanças "reais". Se a gente usar
  // `element.value = x`, cai nesse setter substituído e o React acha que nada
  // mudou (não dispara onChange). O truque é chamar o setter NATIVO do protótipo
  // diretamente, ignorando o override da instância, e só então disparar o evento.
  function setNativeValue(element, value) {
    var prototype = Object.getPrototypeOf(element);
    var descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new FocusEvent("blur"));
    element.dispatchEvent(new Event("focusout", { bubbles: true }));
  }

  function setNativeChecked(element, checked) {
    var prototype = Object.getPrototypeOf(element);
    var descriptor = Object.getOwnPropertyDescriptor(prototype, "checked");

    if (descriptor && descriptor.set) {
      descriptor.set.call(element, checked);
    } else {
      element.checked = checked;
    }

    element.dispatchEvent(new Event("click", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // ---------------------------------------------------------------------
  // Detecção do tipo de campo
  // ---------------------------------------------------------------------

  var COMBINING_MARKS_RE = new RegExp("[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]", "g");

  function normalize(str) {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(COMBINING_MARKS_RE, "");
  }

  function getLabelText(element) {
    if (element.labels && element.labels.length) {
      return Array.prototype.map.call(element.labels, function (l) {
        return l.textContent || "";
      }).join(" ");
    }
    return "";
  }

  // Fallback para quando não há <label for> nem wrapping real (comum em
  // componentes React/Vue com "floating label" solto em <span>/<div>): pega o
  // texto do irmão anterior ou de outro filho curto no mesmo container.
  function getNearbyText(element) {
    var prev = element.previousElementSibling;
    if (prev && /^(label|span|div|p|small|strong)$/i.test(prev.tagName)) {
      var prevText = (prev.textContent || "").trim();
      if (prevText && prevText.length < 60) return prevText;
    }

    var parent = element.parentElement;
    if (!parent) return "";
    for (var i = 0; i < parent.childNodes.length; i++) {
      var node = parent.childNodes[i];
      if (node === element) continue;
      var text = (node.textContent || "").trim();
      if (text && text.length < 60) return text;
    }
    return "";
  }

  function buildContext(element) {
    var parts = [
      element.name,
      element.id,
      element.getAttribute("placeholder"),
      element.getAttribute("autocomplete"),
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("pattern"),
      element.getAttribute("inputmode"),
      getLabelText(element)
    ].filter(Boolean);

    return normalize(parts.join(" "));
  }

  function matchDetectionRules(ctx) {
    if (!ctx) return null;
    for (var i = 0; i < DETECTION_RULES.length; i++) {
      if (DETECTION_RULES[i].re.test(ctx)) return DETECTION_RULES[i].type;
    }
    return null;
  }

  function detectFieldType(element) {
    var override = element.getAttribute("web-copilot");
    if (override) {
      return LEGACY_ALIASES[override] || override;
    }

    var type = matchDetectionRules(buildContext(element));
    // name/id quase sempre existem (mesmo genéricos, tipo "doc2"), então o
    // contexto principal raramente vem vazio. Só tenta o texto vizinho (label
    // solto, sem <label for>) como segunda passada, depois que o principal falhou.
    if (!type) type = matchDetectionRules(normalize(getNearbyText(element)));
    if (type) return type;

    switch (element.type) {
      case "email": return "email";
      case "tel": return "phone";
      case "date": return "birthday";
      case "password": return "password";
      default: return null;
    }
  }

  // ---------------------------------------------------------------------
  // Cor de destaque: usa a cor principal do site em vez de uma cor fixa
  // ---------------------------------------------------------------------

  var ACCENT_VAR_NAMES = [
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
    value = value.trim();
    if (!value || value === "transparent" || value === "inherit" || value === "initial" || value === "none") return false;

    var rgb = colorToRgb(value);
    if (!rgb) return false;
    // Perto do branco não dá pra ver como borda na maioria dos formulários.
    if (rgb.r > 245 && rgb.g > 245 && rgb.b > 245) return false;
    return true;
  }

  function findSiteAccentColor() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && isUsableAccent(meta.content)) return meta.content.trim();

    var rootStyle = getComputedStyle(document.documentElement);
    for (var i = 0; i < ACCENT_VAR_NAMES.length; i++) {
      var value = rootStyle.getPropertyValue(ACCENT_VAR_NAMES[i]);
      if (isUsableAccent(value)) return value.trim();
    }

    var candidates = document.querySelectorAll(
      'button[type="submit"], input[type="submit"], .btn-primary, .primary, a.button'
    );
    for (var j = 0; j < candidates.length; j++) {
      var bg = getComputedStyle(candidates[j]).backgroundColor;
      if (isUsableAccent(bg)) return bg;
    }

    return "#f6c231";
  }

  function getSiteAccentColor() {
    if (!window.__wcAccentColor) window.__wcAccentColor = findSiteAccentColor();
    return window.__wcAccentColor;
  }

  // ---------------------------------------------------------------------
  // Preenchimento
  // ---------------------------------------------------------------------

  function fillSelect(select, type, profile) {
    var options = Array.prototype.filter.call(select.options, function (o) { return o.value !== ""; });
    if (!options.length) return false;

    var target = null;
    if (type === "state") {
      target = options.filter(function (o) {
        var norm = normalize(o.textContent + " " + o.value);
        return norm.indexOf(normalize(profile.location.state)) !== -1;
      })[0];
    }
    if (!target) return false;

    setNativeValue(select, target.value);
    return true;
  }

  function fillElement(element, type, profile) {
    if (element.disabled) return false;

    if (element.type === "checkbox" || element.type === "radio") {
      if (type === "terms" && !element.checked) {
        setNativeChecked(element, true);
        return true;
      }
      return false;
    }

    if (element.tagName === "SELECT") {
      return fillSelect(element, type, profile);
    }

    if (element.readOnly) return false;

    if (type === "birthday") {
      var value = element.type === "date" ? toISODate(profile.birthdayDate) : toBRDate(profile.birthdayDate);
      setNativeValue(element, value);
      return true;
    }

    var generators = {
      email: function () { return generateEmail(profile); },
      password: generatePassword,
      cpfCnpj: function () { return chance.bool() ? chance.cpf() : chance.cnpj(); },
      cnpj: function () { return chance.cnpj(); },
      cpf: function () { return chance.cpf(); },
      companyName: generateCompanyName,
      cep: generateCEP,
      phone: generatePhone,
      age: function () { return String(profile.age); },
      neighborhood: function () { return chance.capitalize(chance.word({ syllables: 2 })); },
      complement: function () { return chance.pickone(COMPLEMENTS); },
      streetNumber: function () { return String(chance.natural({ min: 1, max: 2500 })); },
      street: function () { return chance.street(); },
      state: function () { return profile.location.state; },
      city: function () { return profile.location.city; },
      fullName: function () { return profile.fullName; },
      firstName: function () { return profile.firstName; },
      lastName: function () { return profile.lastName; },
      name: function () { return profile.fullName; }
    };

    var generator = generators[type];
    if (!generator) return false;

    setNativeValue(element, generator());
    return true;
  }

  // Marca visualmente o campo com a cor de destaque, garantindo que a borda
  // apareça mesmo em sites que zeram `border` por padrão (ex: Tailwind reset).
  function highlightElement(element, color) {
    var computed = getComputedStyle(element);
    if (parseFloat(computed.borderWidth) === 0 || computed.borderStyle === "none") {
      element.style.borderStyle = "solid";
      element.style.borderWidth = "2px";
    }
    element.style.borderColor = color;
  }

  // Insere (ou reaproveita) o textinho "Atualizado pelo WebCopilot" logo
  // abaixo do campo preenchido.
  function addFilledHint(element, color, message) {
    var next = element.nextElementSibling;
    if (next && next.classList && next.classList.contains("wc-hint")) {
      next.textContent = message;
      next.style.color = color;
      return;
    }

    var hint = document.createElement("small");
    hint.className = "wc-hint";
    hint.textContent = message;
    hint.style.cssText =
      "display:block;flex-basis:100%;font-size:11px;line-height:1.3;margin-top:2px;" +
      "font-family:-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif;color:" + color + ";";
    element.insertAdjacentElement("afterend", hint);
  }

  function fillForm(showSuggestions, force) {
    var profile = createProfile();
    var fields = document.querySelectorAll("input, select, textarea");
    var filledCount = 0;
    var accentColor = getSiteAccentColor();

    fields.forEach(function (element) {
      if (["submit", "button", "reset", "hidden", "file", "image"].indexOf(element.type) !== -1) return;
      if (force) delete element.dataset.wcFilled;
      if (element.dataset.wcFilled === "1") return;

      var type = detectFieldType(element);
      if (!type) return;

      if (showSuggestions) {
        element.title = "Web Copilot: sugestão de " + (FIELD_LABELS[type] || type);
      }

      if (fillElement(element, type, profile)) {
        element.dataset.wcFilled = "1";
        highlightElement(element, accentColor);

        var isCheckable = element.type === "checkbox" || element.type === "radio";
        addFilledHint(element, accentColor, isCheckable ? "Marcado pelo WebCopilot" : "Atualizado pelo WebCopilot");

        filledCount++;
      }
    });

    if (filledCount) wcLog(filledCount + " campo(s) preenchido(s)");
    return filledCount;
  }

  function debounce(fn, wait) {
    var timer;
    return function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }

  function startWatching(showSuggestions) {
    fillForm(showSuggestions, false);
    observer = new MutationObserver(debounce(function () {
      fillForm(showSuggestions, false);
    }, 400));
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // ---------------------------------------------------------------------
  // Preenchimento sob demanda (popup / atalho), independente do toggle
  // ---------------------------------------------------------------------

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message && message.type === "WC_FILL_NOW") {
      chrome.storage.sync.get(["WC_show_suggestions"], function (items) {
        var count = fillForm(!!items.WC_show_suggestions, true);
        sendResponse({ ok: true, count: count });
      });
      return true;
    }
  });

  // ---------------------------------------------------------------------
  // Inicialização
  // ---------------------------------------------------------------------

  chrome.storage.sync.get(["WC_autocomplete", "WC_show_suggestions"], function (items) {
    wcLog("WC_items", items);
    if (items.WC_autocomplete) {
      startWatching(!!items.WC_show_suggestions);
    } else {
      wcLog("WC_autocomplete is disabled");
    }
  });

  function wcLog(msg, extra) {
    console.log("%c WC > %c" + msg, "color:#f6c231", "color:#c1c1c1", extra !== undefined ? extra : "");
  }
})();
