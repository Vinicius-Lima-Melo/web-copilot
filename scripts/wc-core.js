/**
 * Web Copilot — núcleo compartilhado.
 *
 * Este arquivo é carregado tanto no content script quanto no service worker
 * (via importScripts) e nos testes em Node, por isso ele não pode tocar em
 * `document` nem em `chrome`: só lógica pura pendurada em `root.WC`.
 */
(function (root) {
  "use strict";

  var WC = (root.WC = root.WC || {});

  WC.VERSION = "2.0.0";

  // -------------------------------------------------------------------
  // PRNG determinístico
  //
  // Math.random() não aceita semente, e sem semente não dá para reproduzir
  // um bug ("o cadastro quebrou com AQUELE CPF"). Mulberry32 + hash FNV-1a
  // dá uma sequência estável a partir de qualquer string de semente.
  // -------------------------------------------------------------------

  function hashSeed(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * @param {string|number|null} seed  null/vazio => aleatório de verdade.
   */
  function Random(seed) {
    this.seed = seed === null || seed === undefined || seed === "" ? null : String(seed);
    this._next = this.seed ? mulberry32(hashSeed(this.seed)) : Math.random;
  }

  Random.prototype.float = function (min, max) {
    if (min === undefined) return this._next();
    return min + this._next() * (max - min);
  };

  // Inclusivo nas duas pontas — é o que se espera ao pedir "um número de 1 a 6".
  Random.prototype.int = function (min, max) {
    return Math.floor(this._next() * (max - min + 1)) + min;
  };

  Random.prototype.bool = function (probability) {
    return this._next() < (probability === undefined ? 0.5 : probability);
  };

  Random.prototype.pick = function (list) {
    return list[Math.floor(this._next() * list.length)];
  };

  Random.prototype.pickMany = function (list, count) {
    return this.shuffle(list).slice(0, count);
  };

  Random.prototype.shuffle = function (list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(this._next() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  };

  /** pairs: [[valor, peso], ...] */
  Random.prototype.weighted = function (pairs) {
    var total = 0;
    var i;
    for (i = 0; i < pairs.length; i++) total += pairs[i][1];
    var roll = this._next() * total;
    for (i = 0; i < pairs.length; i++) {
      roll -= pairs[i][1];
      if (roll <= 0) return pairs[i][0];
    }
    return pairs[pairs.length - 1][0];
  };

  Random.prototype.chars = function (count, pool) {
    var out = "";
    for (var i = 0; i < count; i++) out += pool.charAt(Math.floor(this._next() * pool.length));
    return out;
  };

  Random.prototype.digits = function (count) {
    return this.chars(count, "0123456789");
  };

  Random.prototype.uuid = function () {
    var hex = "0123456789abcdef";
    var out = "";
    for (var i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) out += "-";
      else if (i === 14) out += "4";
      else if (i === 19) out += hex.charAt((Math.floor(this._next() * 16) & 0x3) | 0x8);
      else out += hex.charAt(Math.floor(this._next() * 16));
    }
    return out;
  };

  // -------------------------------------------------------------------
  // Texto
  // -------------------------------------------------------------------

  // Construído por charCode porque o range ̀-ͯ escrito direto no
  // fonte vira lixo se o arquivo for salvo/servido em outro encoding.
  var COMBINING_MARKS_RE = new RegExp("[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]", "g");

  function deburr(str) {
    return String(str === null || str === undefined ? "" : str)
      .normalize("NFD")
      .replace(COMBINING_MARKS_RE, "");
  }

  /** Forma canônica usada por toda a detecção: minúsculo, sem acento, espaço simples. */
  function normalize(str) {
    return deburr(str).toLowerCase().replace(/\s+/g, " ").trim();
  }

  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
  }

  function onlyDigits(str) {
    return String(str || "").replace(/\D+/g, "");
  }

  function pad(value, length, char) {
    var out = String(value);
    while (out.length < length) out = (char || "0") + out;
    return out;
  }

  function slugify(str) {
    return normalize(str).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  /**
   * Aplica uma máscara posicional: "###.###.###-##" + "12345678909".
   * Caracteres diferentes de `#` são literais.
   */
  function applyMask(value, mask) {
    var chars = String(value).split("");
    var out = "";
    for (var i = 0; i < mask.length; i++) {
      if (mask.charAt(i) === "#") {
        if (!chars.length) break;
        out += chars.shift();
      } else if (chars.length) {
        out += mask.charAt(i);
      }
    }
    return out;
  }

  WC.Random = Random;
  WC.hashSeed = hashSeed;
  WC.text = {
    deburr: deburr,
    normalize: normalize,
    capitalize: capitalize,
    onlyDigits: onlyDigits,
    pad: pad,
    slugify: slugify,
    applyMask: applyMask
  };

  if (typeof module !== "undefined" && module.exports) module.exports = WC;
})(typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : globalThis);
