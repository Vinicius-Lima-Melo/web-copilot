/**
 * Web Copilot — camada de DOM: achar campos, extrair sinais e preencher.
 *
 * Tudo que toca no navegador mora aqui; os outros módulos são lógica pura.
 */
(function (root) {
  "use strict";

  var WC = (root.WC = root.WC || {});
  var T = WC.text;

  var FIELD_SELECTOR = "input, select, textarea, [contenteditable=''], [contenteditable='true']";
  var IGNORED_INPUT_TYPES = ["submit", "button", "reset", "hidden", "file", "image"];

  // Classes utilitárias (Tailwind, Bootstrap, prefixos de framework) só
  // fazem barulho na detecção: "text-sm" casaria com a regra de "texto".
  var UTILITY_CLASS_RE = /^(text|bg|p|m|w|h|min|max|border|rounded|shadow|font|items|justify|gap|grid|flex|col|row|px|py|mx|my|mt|mb|ml|mr|pt|pb|pl|pr|space|leading|tracking|hover|focus|active|disabled|sm|md|lg|xl|xxl|is|has|js|ng|v|el|mat|mui|css|sc|chakra|ant|form|input|field|control|group|wrapper|container|row|block|inline)([-_].*)?$/;

  var undoStack = [];

  // -------------------------------------------------------------------
  // Coleta de campos (inclui shadow DOM aberto)
  // -------------------------------------------------------------------

  function collectFields(scope) {
    var out = [];
    var seen = new Set();

    function walk(node, depth) {
      if (!node || depth > 8) return;
      // Não coletar os campos da própria UI da extensão (HUD em shadow root).
      if (node.host && node.host.hasAttribute && node.host.hasAttribute("data-wc-ui")) return;
      var found;
      try {
        found = node.querySelectorAll(FIELD_SELECTOR);
      } catch (e) {
        return;
      }
      for (var i = 0; i < found.length; i++) {
        if (!seen.has(found[i])) {
          seen.add(found[i]);
          out.push(found[i]);
        }
      }
      // Web components: os campos reais moram dentro do shadow root.
      // TreeWalker em vez de querySelectorAll("*") — percorre a mesma árvore
      // sem materializar um array com a página inteira a cada varredura (e
      // isto roda a cada mutação do DOM em SPA).
      var doc = node.ownerDocument || node;
      var walker = doc.createTreeWalker(node, NodeFilter.SHOW_ELEMENT, {
        acceptNode: function (candidate) {
          return candidate.shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      });
      while (walker.nextNode()) walk(walker.currentNode.shadowRoot, depth + 1);
    }

    walk(scope || document, 0);
    return out;
  }

  function isRendered(element) {
    if (element.type === "hidden") return false;
    if (element.offsetParent !== null) return true;
    // offsetParent é null para position:fixed — confere pelo retângulo.
    var rects = element.getClientRects();
    return rects.length > 0 && rects[0].width > 0 && rects[0].height > 0;
  }

  function isFillable(element, options) {
    if (element.disabled || element.readOnly) return false;
    if (IGNORED_INPUT_TYPES.indexOf(element.type) !== -1) return false;
    if (element.getAttribute("aria-hidden") === "true") return false;
    // Campos não renderizados costumam ser honeypot de antispam; preencher
    // entrega a extensão como bot. Etapas de wizard são pegas depois, quando
    // aparecem, pelo MutationObserver.
    if (!options.fillHidden && !isRendered(element)) return false;
    return true;
  }

  // -------------------------------------------------------------------
  // Sinais para a detecção
  // -------------------------------------------------------------------

  function labelText(element) {
    var parts = [];

    if (element.labels && element.labels.length) {
      for (var i = 0; i < element.labels.length; i++) parts.push(element.labels[i].textContent || "");
    }

    var describedBy = element.getAttribute("aria-labelledby");
    if (describedBy) {
      describedBy.split(/\s+/).forEach(function (id) {
        var node = document.getElementById(id);
        if (node) parts.push(node.textContent || "");
      });
    }

    if (!parts.length) {
      var wrapper = element.closest ? element.closest("label") : null;
      if (wrapper) parts.push(wrapper.textContent || "");
    }

    return parts.join(" ").slice(0, 200);
  }

  /**
   * Label solto: floating label em <span>/<div> que não é <label for>.
   * Comum em React/Vue/Material.
   */
  function nearbyText(element) {
    var prev = element.previousElementSibling;
    if (prev && /^(label|span|div|p|small|strong|b|legend)$/i.test(prev.tagName)) {
      var prevText = (prev.textContent || "").trim();
      if (prevText && prevText.length < 80) return prevText;
    }

    var parent = element.parentElement;
    if (!parent) return "";

    for (var i = 0; i < parent.childNodes.length; i++) {
      var node = parent.childNodes[i];
      if (node === element) continue;
      var text = (node.textContent || "").trim();
      if (text && text.length < 80) return text;
    }

    // Sobe um nível: wrappers de design system costumam ter 2 camadas.
    var grand = parent.parentElement;
    if (grand) {
      var heading = grand.querySelector("label, legend, .label, [class*=label]");
      if (heading) {
        var headingText = (heading.textContent || "").trim();
        if (headingText && headingText.length < 80) return headingText;
      }
    }
    return "";
  }

  function dataAttrText(element) {
    var out = [];
    var attrs = element.attributes;
    for (var i = 0; i < attrs.length; i++) {
      var name = attrs[i].name;
      if (name.indexOf("data-") === 0 || name === "formcontrolname" || name === "ng-reflect-name") {
        out.push(name.replace(/^data-/, "").replace(/-/g, " ") + " " + attrs[i].value);
      }
    }
    return out.join(" ").slice(0, 200);
  }

  function usefulClassNames(element) {
    var raw = typeof element.className === "string" ? element.className : "";
    return raw
      .split(/\s+/)
      .filter(function (token) { return token && !UTILITY_CLASS_RE.test(token); })
      .join(" ")
      .replace(/[-_]/g, " ")
      .slice(0, 120);
  }

  function extractSignals(element) {
    var maxLength = Number(element.getAttribute("maxlength"));
    return {
      autocomplete: element.getAttribute("autocomplete") || "",
      name: element.getAttribute("name") || "",
      id: element.id || "",
      label: labelText(element),
      aria: element.getAttribute("aria-label") || "",
      placeholder: element.getAttribute("placeholder") || "",
      title: element.getAttribute("title") || "",
      dataAttr: dataAttrText(element),
      className: usefulClassNames(element),
      pattern: (element.getAttribute("pattern") || "") + " " + (element.getAttribute("inputmode") || ""),
      nearby: nearbyText(element),
      inputType: (element.getAttribute("type") || "").toLowerCase(),
      tagName: element.tagName.toLowerCase(),
      maxLength: maxLength > 0 ? maxLength : 0
    };
  }

  /** Seletor estável o suficiente para gravar um "ensinamento" por domínio. */
  function selectorFor(element) {
    if (element.id && !/^\d/.test(element.id)) return "#" + CSS.escape(element.id);
    var name = element.getAttribute("name");
    if (name) return element.tagName.toLowerCase() + '[name="' + name.replace(/"/g, '\\"') + '"]';

    var path = [];
    var node = element;
    while (node && node.nodeType === 1 && path.length < 4) {
      var part = node.tagName.toLowerCase();
      var parent = node.parentElement;
      if (parent) {
        var siblings = Array.prototype.filter.call(parent.children, function (c) { return c.tagName === node.tagName; });
        if (siblings.length > 1) part += ":nth-of-type(" + (siblings.indexOf(node) + 1) + ")";
      }
      path.unshift(part);
      node = node.parentElement;
    }
    return path.join(" > ");
  }

  // -------------------------------------------------------------------
  // Escrita compatível com inputs controlados (React/Vue/Angular)
  // -------------------------------------------------------------------

  // React troca o setter de `value` na própria instância para rastrear
  // mudanças. Escrever direto cai nesse setter e o onChange nunca dispara.
  // Chamando o setter NATIVO do protótipo o valor entra "por baixo" e o
  // evento de input que a gente dispara em seguida é aceito como real.
  function nativeSetter(element, prop, value) {
    var proto = Object.getPrototypeOf(element);
    var descriptor = Object.getOwnPropertyDescriptor(proto, prop);
    if (descriptor && descriptor.set) descriptor.set.call(element, value);
    else element[prop] = value;
  }

  function fireInput(element, data) {
    element.dispatchEvent(new InputEvent("input", { bubbles: true, data: data === undefined ? null : data, inputType: "insertText" }));
  }

  function commit(element) {
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new FocusEvent("blur", { bubbles: false }));
    element.dispatchEvent(new Event("focusout", { bubbles: true }));
  }

  function setValue(element, value) {
    element.focus({ preventScroll: true });
    nativeSetter(element, "value", value);
    fireInput(element, value);
    commit(element);
  }

  /**
   * Digita caractere a caractere. Máscaras que só reagem a keydown/keyup
   * (jQuery Mask, IMask, v-mask antigos) precisam disso; sem essa opção o
   * campo fica com o valor cru e o site rejeita no submit.
   */
  /** Uma tecla: a sequência de eventos que um campo com máscara espera ver. */
  function pressKey(element, char) {
    var keyInit = { key: char, bubbles: true, cancelable: true };
    element.dispatchEvent(new KeyboardEvent("keydown", keyInit));
    element.dispatchEvent(new KeyboardEvent("keypress", keyInit));
    element.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, data: char, inputType: "insertText" }));
    // A máscara pode ter reformatado o que já estava lá — parte-se do valor
    // atual do campo, não do que a gente acha que escreveu.
    nativeSetter(element, "value", element.value + char);
    fireInput(element, char);
    element.dispatchEvent(new KeyboardEvent("keyup", keyInit));
  }

  /**
   * Intervalo entre teclas, em ms. Não é fixo de propósito: cadência
   * perfeitamente regular lê como máquina, não como pessoa. A variação é
   * pequena o bastante para não deixar a digitação lenta.
   */
  function keyDelay(rnd, base) {
    var jitter = rnd ? rnd.int(-6, 10) : 0;
    return Math.max(6, base + jitter);
  }

  /**
   * Digita caractere a caractere.
   *
   * `delayMs = 0` roda tudo de uma vez, sem ceder o event loop — é o caminho
   * usado por campo com máscara quando a animação está desligada: a máscara
   * precisa dos eventos de tecla, mas ninguém precisa ver isso acontecendo.
   *
   * `delayMs > 0` espaça as teclas no tempo e devolve uma Promise. Aí dá para
   * ver o texto aparecendo, que é o efeito pedido.
   */
  function typeValue(element, value, delayMs, rnd) {
    element.focus({ preventScroll: true });
    nativeSetter(element, "value", "");
    fireInput(element, "");

    if (!delayMs) {
      for (var i = 0; i < value.length; i++) pressKey(element, value.charAt(i));
      commit(element);
      return null;
    }

    return new Promise(function (resolve) {
      var i = 0;
      (function next() {
        if (i >= value.length) {
          commit(element);
          return resolve(value);
        }
        // Campo pode sumir no meio da digitação (SPA re-renderizou o passo do
        // wizard). Parar aqui evita disparar evento em nó órfão.
        if (!element.isConnected) return resolve(value);
        pressKey(element, value.charAt(i++));
        setTimeout(next, keyDelay(rnd, delayMs));
      })();
    });
  }

  function setChecked(element, checked) {
    if (element.checked === checked) return;
    element.focus({ preventScroll: true });

    // click() dispara o comportamento de ativação nativo (que é o que React
    // escuta em checkbox) e já deixa o estado certo. Setar `checked` à mão e
    // DEPOIS despachar um click faria o navegador alternar de novo, desmarcando
    // o que a gente acabou de marcar.
    element.click();

    if (element.checked !== checked) {
      // O site cancelou o click (preventDefault) — força pelo setter nativo.
      nativeSetter(element, "checked", checked);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function setContentEditable(element, value) {
    element.focus({ preventScroll: true });
    element.textContent = value;
    fireInput(element, value);
    commit(element);
  }

  // -------------------------------------------------------------------
  // Máscaras
  // -------------------------------------------------------------------

  var MASK_ATTRS = ["data-mask", "data-maskto", "v-mask", "x-mask", "mask", "data-inputmask", "data-slots", "data-thmask"];

  /**
   * Só considera "mascarado" quando existe uma lib declarada. Placeholder
   * com cara de máscara ("000.000.000-00") é dica visual e não garante que
   * algo vá formatar — mandar dígito cru nesse caso deixaria o campo feio.
   */
  function isMasked(element) {
    for (var i = 0; i < MASK_ATTRS.length; i++) {
      if (element.hasAttribute(MASK_ATTRS[i])) return true;
    }
    var cls = typeof element.className === "string" ? element.className : "";
    return /\b(mask|masked|imask|cleave)\b/i.test(cls);
  }

  // -------------------------------------------------------------------
  // Selects e rádios
  // -------------------------------------------------------------------

  var PLACEHOLDER_OPTION_RE = /^(|-+|selecione|select|escolha|choose|todos|nenhum|none|--.*--)$/;

  function optionCandidates(type, persona) {
    var a = persona.address;
    switch (type) {
      case "state": return [a.state, a.stateName];
      case "stateName": return [a.stateName, a.state];
      case "city": return [a.city];
      case "country": return [a.country, a.countryCode, "Brazil"];
      case "gender": return [persona.genderLabel, persona.gender];
      case "maritalStatus": return [persona.maritalStatus, persona.maritalStatus.replace(/\(a\)/, "")];
      case "education": return [persona.education];
      case "bloodType": return [persona.bloodType];
      case "cardBrand": return [persona.card.brand];
      case "bankName": return [persona.bank.name, persona.bank.code];
      case "bankCode": return [persona.bank.code, persona.bank.name];
      case "vehicleBrand": return [persona.vehicle.brand];
      case "vehicleModel": return [persona.vehicle.model];
      case "vehicleYear": return [persona.vehicle.year];
      case "vehicleColor": return [persona.vehicle.color];
      case "nationality": return [persona.nationality];
      case "cardExpiryMonth": return [persona.card.expiryMonth, String(Number(persona.card.expiryMonth))];
      case "cardExpiryYear": return [persona.card.expiryYear, persona.card.expiryYear.slice(2)];
      case "jobTitle": return [persona.company.jobTitle];
      case "department": return [persona.company.department];
      default: return null;
    }
  }

  function matchOption(select, candidates) {
    var options = Array.prototype.slice.call(select.options);
    var i, j;

    for (j = 0; j < candidates.length; j++) {
      var wanted = T.normalize(candidates[j]);
      if (!wanted) continue;
      for (i = 0; i < options.length; i++) {
        if (T.normalize(options[i].value) === wanted || T.normalize(options[i].textContent) === wanted) return options[i];
      }
      for (i = 0; i < options.length; i++) {
        var text = T.normalize(options[i].textContent);
        if (text && text.indexOf(wanted) !== -1) return options[i];
      }
    }
    return null;
  }

  function fillSelect(select, type, persona, rnd, options) {
    var candidates = type === "@option" ? null : optionCandidates(type, persona);
    var target = candidates ? matchOption(select, candidates) : null;

    if (!target && options.fillUnknownSelects) {
      // Sem correspondência semântica: qualquer opção real serve melhor que
      // deixar "Selecione" e travar o submit.
      var real = Array.prototype.filter.call(select.options, function (o) {
        return o.value !== "" && !o.disabled && !PLACEHOLDER_OPTION_RE.test(T.normalize(o.textContent));
      });
      if (real.length) target = rnd.pick(real);
    }

    if (!target) return null;

    if (select.multiple) {
      target.selected = true;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      nativeSetter(select, "value", target.value);
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return target.textContent.trim() || target.value;
  }

  var filledRadioGroups = null;

  function fillRadio(element, type, persona, rnd) {
    var name = element.getAttribute("name");
    if (name && filledRadioGroups.has(name)) return null;

    var group = name
      ? Array.prototype.filter.call(document.getElementsByName(name), function (n) { return n.type === "radio" && !n.disabled; })
      : [element];
    if (!group.length) return null;

    var target = null;
    var candidates = optionCandidates(type, persona);
    if (candidates) {
      for (var c = 0; c < candidates.length && !target; c++) {
        var wanted = T.normalize(candidates[c]);
        for (var i = 0; i < group.length; i++) {
          var text = T.normalize(group[i].value + " " + labelText(group[i]));
          if (wanted && text.indexOf(wanted) !== -1) {
            target = group[i];
            break;
          }
        }
      }
    }
    if (!target) target = rnd.pick(group);

    setChecked(target, true);
    if (name) filledRadioGroups.add(name);
    return target.value || labelText(target).trim();
  }

  // -------------------------------------------------------------------
  // Destaque visual
  // -------------------------------------------------------------------

  // outline não ocupa espaço no layout (border ocupa e empurra a página);
  // por isso o destaque virou outline nesta versão.
  function highlight(element, color) {
    element.style.setProperty("outline", "2px solid " + color, "important");
    element.style.setProperty("outline-offset", "1px", "important");
    element.setAttribute("data-wc-filled", "1");
  }

  function clearHighlight(element) {
    element.style.removeProperty("outline");
    element.style.removeProperty("outline-offset");
    element.removeAttribute("data-wc-filled");
    var hint = element.nextElementSibling;
    if (hint && hint.classList && hint.classList.contains("wc-hint")) hint.remove();
  }

  function addHint(element, color, message) {
    var next = element.nextElementSibling;
    if (next && next.classList && next.classList.contains("wc-hint")) {
      next.textContent = message;
      next.style.color = color;
      return;
    }
    var hint = document.createElement("small");
    hint.className = "wc-hint";
    hint.setAttribute("data-wc-ui", "1");
    hint.textContent = message;
    hint.style.cssText =
      "display:block;flex-basis:100%;font-size:11px;line-height:1.3;margin-top:2px;" +
      "font-family:-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif;color:" + color + ";";
    element.insertAdjacentElement("afterend", hint);
  }

  // -------------------------------------------------------------------
  // Preenchimento de um campo
  // -------------------------------------------------------------------

  function rememberForUndo(element) {
    undoStack.push({
      element: element,
      value: element.value,
      checked: element.checked,
      text: element.isContentEditable ? element.textContent : null
    });
  }

  /**
   * @returns {string|null} o valor aplicado, ou null se nada foi preenchido.
   */
  function fillField(element, type, persona, rnd, options) {
    options = options || {};
    var tag = element.tagName.toLowerCase();
    var inputType = (element.getAttribute("type") || "").toLowerCase();

    rememberForUndo(element);

    if (element.isContentEditable) {
      var richValue = WC.values.valueFor(type, persona, rnd, { mode: options.mode, inputType: "text", maxLength: 0, masked: false });
      if (richValue === null) return null;
      setContentEditable(element, richValue);
      return richValue;
    }

    if (tag === "select") return fillSelect(element, type, persona, rnd, options);

    if (inputType === "radio") return fillRadio(element, type, persona, rnd);

    if (inputType === "checkbox") {
      var checkable = ["terms", "newsletter", "optIn"].indexOf(type) !== -1;
      if (!checkable && !options.checkUnknownBoxes) return null;
      setChecked(element, true);
      return "marcado";
    }

    var maxLength = Number(element.getAttribute("maxlength"));
    var masked = isMasked(element);
    var value = WC.values.valueFor(type, persona, rnd, {
      mode: options.mode,
      inputType: inputType || tag,
      maxLength: maxLength > 0 ? maxLength : 0,
      masked: masked
    });
    if (value === null) return null;

    // Inputs de tipo estrito só aceitam o formato deles; um "R$ 1.234,56"
    // em <input type=number> é descartado silenciosamente pelo navegador.
    if (inputType === "number" || inputType === "range") {
      var numeric = value.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
      value = numeric || String(rnd.int(1, 100));
    }

    /**
     * A animação não roda aqui dentro. `fillField` sempre devolve o valor
     * final como string — mudar isso para uma Promise quebraria todo chamador
     * (`String(applied)` viraria "[object Object]" no relatório).
     *
     * Quando o chamador quer o efeito de digitação, ele passa um array em
     * `options.typingQueue` e recebe de volta thunks para executar na ordem
     * que quiser. É o que faz o preenchimento sair um campo de cada vez em vez
     * de todos os campos digitando ao mesmo tempo.
     */
    if (options.humanTyping && options.typingQueue) {
      var speed = options.typingSpeed || 22;
      options.typingQueue.push(function () { return typeValue(element, value, speed, rnd); });
    } else if (options.humanTyping || masked) {
      typeValue(element, value, 0, rnd);
    } else {
      setValue(element, value);
    }

    return value;
  }

  /**
   * Executa os thunks de digitação em série — um campo termina antes do
   * próximo começar. Em paralelo, todos os campos apareceriam digitando ao
   * mesmo tempo, que não é a sensação de alguém preenchendo um formulário.
   */
  function runTypingQueue(queue) {
    return (queue || []).reduce(function (chain, thunk) {
      return chain.then(function () {
        try { return thunk(); } catch (e) { return null; }
      });
    }, Promise.resolve());
  }

  function undoAll() {
    var restored = 0;
    while (undoStack.length) {
      var entry = undoStack.pop();
      var element = entry.element;
      if (!element || !element.isConnected) continue;
      try {
        if (entry.text !== null && element.isContentEditable) setContentEditable(element, entry.text);
        else if (element.type === "checkbox" || element.type === "radio") setChecked(element, entry.checked);
        else setValue(element, entry.value);
        clearHighlight(element);
        restored++;
      } catch (e) { /* elemento pode ter sido re-renderizado; segue */ }
    }
    return restored;
  }

  function resetRadioGroups() {
    filledRadioGroups = new Set();
  }

  resetRadioGroups();

  WC.dom = {
    collectFields: collectFields,
    isFillable: isFillable,
    runTypingQueue: runTypingQueue,
    isRendered: isRendered,
    extractSignals: extractSignals,
    selectorFor: selectorFor,
    fillField: fillField,
    highlight: highlight,
    clearHighlight: clearHighlight,
    addHint: addHint,
    undoAll: undoAll,
    resetRadioGroups: resetRadioGroups,
    undoSize: function () { return undoStack.length; },
    setValue: setValue,
    typeValue: typeValue,
    setChecked: setChecked,
    labelText: labelText
  };
})(typeof window !== "undefined" ? window : globalThis);
