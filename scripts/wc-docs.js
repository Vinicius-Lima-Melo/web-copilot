/**
 * Web Copilot — documentos brasileiros com dígito verificador de verdade.
 *
 * Cada documento tem gerador e validador no mesmo lugar, de propósito: o
 * validador é o teste do gerador (ver tests/), e a extensão também usa os
 * validadores para o modo "dado inválido" — a gente gera, confere que
 * REPROVA e só então entrega, senão o teste negativo passa por acidente.
 */
(function (root) {
  "use strict";

  var WC = (root.WC = root.WC || {});
  var digits = WC.text.onlyDigits;
  var pad = WC.text.pad;
  var mask = WC.text.applyMask;

  function sumWeighted(str, weights, offset) {
    var total = 0;
    for (var i = 0; i < weights.length; i++) {
      total += Number(str.charAt(i + (offset || 0))) * weights[i];
    }
    return total;
  }

  function allSame(str) {
    return /^(\d)\1*$/.test(str);
  }

  // -------------------------------------------------------------------
  // CPF
  // -------------------------------------------------------------------

  function cpfCheckDigits(base9) {
    var d1 = (sumWeighted(base9, [10, 9, 8, 7, 6, 5, 4, 3, 2]) * 10) % 11 % 10;
    var d2 = (sumWeighted(base9 + d1, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) * 10) % 11 % 10;
    return String(d1) + String(d2);
  }

  function cpf(rnd, opts) {
    opts = opts || {};
    var base = rnd.digits(9);
    // 000.000.000-00 e afins passam no cálculo mas são rejeitados por
    // qualquer sistema sério; sortear de novo é mais barato que explicar.
    while (allSame(base)) base = rnd.digits(9);
    var value = base + cpfCheckDigits(base);
    return opts.raw ? value : mask(value, "###.###.###-##");
  }

  function isValidCPF(value) {
    var v = digits(value);
    if (v.length !== 11 || allSame(v)) return false;
    return cpfCheckDigits(v.slice(0, 9)) === v.slice(9);
  }

  // -------------------------------------------------------------------
  // CNPJ — numérico e alfanumérico
  //
  // Desde julho/2026 o CNPJ pode ter letras nas 12 primeiras posições
  // (os 2 DV continuam numéricos). O cálculo é o mesmo, trocando o dígito
  // pelo valor ASCII - 48 ('0'=0 ... '9'=9, 'A'=17 ... 'Z'=42).
  // -------------------------------------------------------------------

  var CNPJ_W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  var CNPJ_W2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  function cnpjCharValue(ch) {
    return ch.charCodeAt(0) - 48;
  }

  function cnpjDv(base, weights) {
    var total = 0;
    for (var i = 0; i < weights.length; i++) total += cnpjCharValue(base.charAt(i)) * weights[i];
    var rest = total % 11;
    return rest < 2 ? 0 : 11 - rest;
  }

  function cnpjCheckDigits(base12) {
    var d1 = cnpjDv(base12, CNPJ_W1);
    var d2 = cnpjDv(base12 + d1, CNPJ_W2);
    return String(d1) + String(d2);
  }

  function cnpj(rnd, opts) {
    opts = opts || {};
    var base;
    if (opts.alphanumeric) {
      base = rnd.chars(8, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") + rnd.digits(4);
    } else {
      // ...0001 é a matriz: é o sufixo que aparece em 99% dos cadastros reais.
      base = rnd.digits(8) + (rnd.bool(0.85) ? "0001" : pad(rnd.int(2, 30), 4));
      while (allSame(base)) base = rnd.digits(8) + "0001";
    }
    var value = base + cnpjCheckDigits(base);
    return opts.raw ? value : mask(value, "##.###.###/####-##");
  }

  function isValidCNPJ(value) {
    var v = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (v.length !== 14) return false;
    if (!/^[A-Z0-9]{12}\d{2}$/.test(v)) return false;
    if (/^0{14}$/.test(v)) return false;
    if (/^\d{14}$/.test(v) && allSame(v)) return false;
    return cnpjCheckDigits(v.slice(0, 12)) === v.slice(12);
  }

  // -------------------------------------------------------------------
  // PIS / PASEP / NIT
  // -------------------------------------------------------------------

  var PIS_W = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  function pisCheckDigit(base10) {
    var rest = sumWeighted(base10, PIS_W) % 11;
    var dv = 11 - rest;
    return dv >= 10 ? 0 : dv;
  }

  function pis(rnd, opts) {
    opts = opts || {};
    var base = rnd.digits(10);
    var value = base + pisCheckDigit(base);
    return opts.raw ? value : mask(value, "###.#####.##-#");
  }

  function isValidPIS(value) {
    var v = digits(value);
    if (v.length !== 11 || allSame(v)) return false;
    return String(pisCheckDigit(v.slice(0, 10))) === v.charAt(10);
  }

  // -------------------------------------------------------------------
  // CNH
  // -------------------------------------------------------------------

  function cnhCheckDigits(base9) {
    var soma1 = 0;
    var soma2 = 0;
    for (var i = 0; i < 9; i++) {
      soma1 += Number(base9.charAt(i)) * (9 - i);
      soma2 += Number(base9.charAt(i)) * (i + 1);
    }
    var dsc = 0;
    var dv1 = soma1 % 11;
    if (dv1 >= 10) {
      dv1 = 0;
      dsc = 2;
    }
    var dv2 = (soma2 % 11) - dsc;
    if (dv2 < 0) dv2 += 11;
    if (dv2 >= 10) dv2 = 0;
    return String(dv1) + String(dv2);
  }

  function cnh(rnd) {
    var base = rnd.digits(9);
    while (allSame(base)) base = rnd.digits(9);
    return base + cnhCheckDigits(base);
  }

  function isValidCNH(value) {
    var v = digits(value);
    if (v.length !== 11 || allSame(v)) return false;
    return cnhCheckDigits(v.slice(0, 9)) === v.slice(9);
  }

  // -------------------------------------------------------------------
  // Título de eleitor: 8 dígitos sequenciais + 2 de UF + 2 DV
  // -------------------------------------------------------------------

  function tituloCheckDigits(base8, uf2) {
    var rest1 = sumWeighted(base8, [2, 3, 4, 5, 6, 7, 8, 9]) % 11;
    var dv1 = rest1 === 10 ? 0 : rest1;
    var rest2 = (Number(uf2.charAt(0)) * 7 + Number(uf2.charAt(1)) * 8 + dv1 * 9) % 11;
    var dv2 = rest2 === 10 ? 0 : rest2;
    return String(dv1) + String(dv2);
  }

  function titulo(rnd) {
    var base = rnd.digits(8);
    var uf = pad(rnd.int(1, 28), 2);
    return base + uf + tituloCheckDigits(base, uf);
  }

  function isValidTitulo(value) {
    var v = digits(value);
    if (v.length !== 12) return false;
    var uf = v.slice(8, 10);
    if (Number(uf) < 1 || Number(uf) > 28) return false;
    return tituloCheckDigits(v.slice(0, 8), uf) === v.slice(10);
  }

  // -------------------------------------------------------------------
  // CNS (Cartão Nacional de Saúde) — faixa definitiva, começa em 1 ou 2
  // -------------------------------------------------------------------

  function cnsFromPis(pis11) {
    var soma = 0;
    for (var i = 0; i < 11; i++) soma += Number(pis11.charAt(i)) * (15 - i);
    var rest = soma % 11;
    var dv = 11 - rest;
    if (dv === 11) dv = 0;
    if (dv === 10) {
      soma += 2;
      rest = soma % 11;
      dv = 11 - rest;
      return pis11 + "001" + dv;
    }
    return pis11 + "000" + dv;
  }

  function cns(rnd, opts) {
    opts = opts || {};
    var base = String(rnd.int(1, 2)) + rnd.digits(10);
    var value = cnsFromPis(base);
    return opts.raw ? value : mask(value, "### #### #### ####");
  }

  function isValidCNS(value) {
    var v = digits(value);
    if (v.length !== 15) return false;
    var soma = 0;
    for (var i = 0; i < 15; i++) soma += Number(v.charAt(i)) * (15 - i);
    return soma % 11 === 0;
  }

  // -------------------------------------------------------------------
  // RENAVAM
  // -------------------------------------------------------------------

  function renavamCheckDigit(base10) {
    var rest = (sumWeighted(base10, [3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) * 10) % 11;
    return rest === 10 ? 0 : rest;
  }

  function renavam(rnd) {
    var base = rnd.digits(10);
    return base + renavamCheckDigit(base);
  }

  function isValidRenavam(value) {
    var v = pad(digits(value), 11);
    if (v.length !== 11) return false;
    return String(renavamCheckDigit(v.slice(0, 10))) === v.charAt(10);
  }

  // -------------------------------------------------------------------
  // RG (padrão SSP-SP: 8 dígitos + DV que pode ser X)
  // -------------------------------------------------------------------

  function rgCheckDigit(base8) {
    var rest = sumWeighted(base8, [2, 3, 4, 5, 6, 7, 8, 9]) % 11;
    return rest === 10 ? "X" : String(rest);
  }

  function rg(rnd, opts) {
    opts = opts || {};
    var base = rnd.digits(8);
    var value = base + rgCheckDigit(base);
    return opts.raw ? value : mask(value.slice(0, 8), "##.###.###") + "-" + value.charAt(8);
  }

  function isValidRG(value) {
    var v = String(value || "").toUpperCase().replace(/[^0-9X]/g, "");
    if (v.length !== 9) return false;
    return rgCheckDigit(v.slice(0, 8)) === v.charAt(8);
  }

  // -------------------------------------------------------------------
  // Inscrição Estadual — SP (12 dígitos, 2 DV em posições separadas)
  // -------------------------------------------------------------------

  function ieSpDv1(base8) {
    var soma = sumWeighted(base8, [1, 3, 4, 5, 6, 7, 8, 10]);
    return String(soma % 11).slice(-1);
  }

  function ieSpDv2(base11) {
    var soma = sumWeighted(base11, [3, 2, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return String(soma % 11).slice(-1);
  }

  function inscricaoEstadual(rnd, opts) {
    opts = opts || {};
    var base = rnd.digits(8);
    var dv1 = ieSpDv1(base);
    var middle = rnd.digits(2);
    var value = base + dv1 + middle;
    value += ieSpDv2(value);
    return opts.raw ? value : mask(value, "###.###.###.###");
  }

  function isValidIE(value) {
    var v = digits(value);
    if (v.length !== 12) return false;
    return ieSpDv1(v.slice(0, 8)) === v.charAt(8) && ieSpDv2(v.slice(0, 11)) === v.charAt(11);
  }

  // -------------------------------------------------------------------
  // Luhn — cartão de crédito e IMEI
  // -------------------------------------------------------------------

  function luhnCheckDigit(partial) {
    var soma = 0;
    var double = true; // o próximo dígito à direita é sempre dobrado
    for (var i = partial.length - 1; i >= 0; i--) {
      var n = Number(partial.charAt(i));
      if (double) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      soma += n;
      double = !double;
    }
    return String((10 - (soma % 10)) % 10);
  }

  function isValidLuhn(value) {
    var v = digits(value);
    if (v.length < 2) return false;
    return luhnCheckDigit(v.slice(0, -1)) === v.slice(-1);
  }

  var CARD_BRANDS = [
    { brand: "Visa", prefixes: ["4"], length: 16, cvv: 3 },
    { brand: "Mastercard", prefixes: ["51", "52", "53", "54", "55"], length: 16, cvv: 3 },
    { brand: "American Express", prefixes: ["34", "37"], length: 15, cvv: 4 },
    { brand: "Elo", prefixes: ["401178", "431274", "506699", "627780", "636297"], length: 16, cvv: 3 },
    { brand: "Hipercard", prefixes: ["606282"], length: 16, cvv: 3 },
    { brand: "Diners Club", prefixes: ["301", "305", "36", "38"], length: 14, cvv: 3 }
  ];

  function creditCard(rnd, opts) {
    opts = opts || {};
    var spec = opts.brand
      ? CARD_BRANDS.filter(function (b) { return b.brand === opts.brand; })[0] || CARD_BRANDS[0]
      : rnd.pick(CARD_BRANDS);
    var prefix = rnd.pick(spec.prefixes);
    var partial = prefix + rnd.digits(spec.length - prefix.length - 1);
    var number = partial + luhnCheckDigit(partial);
    return {
      brand: spec.brand,
      number: number,
      formatted: spec.length === 15 ? mask(number, "#### ###### #####") : mask(number, "#### #### #### ####"),
      cvv: rnd.digits(spec.cvv),
      cvvLength: spec.cvv
    };
  }

  function imei(rnd) {
    // TAC (8 dígitos) + serial (6) + DV Luhn.
    var partial = rnd.digits(14);
    return partial + luhnCheckDigit(partial);
  }

  // -------------------------------------------------------------------
  // EAN-13 / ISBN-13 / código de barras de produto
  // -------------------------------------------------------------------

  function ean13CheckDigit(base12) {
    var soma = 0;
    for (var i = 0; i < 12; i++) soma += Number(base12.charAt(i)) * (i % 2 === 0 ? 1 : 3);
    return String((10 - (soma % 10)) % 10);
  }

  function ean13(rnd, opts) {
    opts = opts || {};
    // 789/790 é o prefixo GS1 do Brasil; 978 é o de livros (ISBN).
    var prefix = opts.isbn ? "978" : rnd.pick(["789", "790"]);
    var base = prefix + rnd.digits(9);
    return base + ean13CheckDigit(base);
  }

  function isValidEAN13(value) {
    var v = digits(value);
    if (v.length !== 13) return false;
    return ean13CheckDigit(v.slice(0, 12)) === v.charAt(12);
  }

  // -------------------------------------------------------------------
  // Chassi / VIN — 17 caracteres, DV na 9ª posição
  // -------------------------------------------------------------------

  var VIN_ALPHABET = "0123456789ABCDEFGHJKLMNPRSTUVWXYZ"; // sem I, O e Q
  var VIN_TRANSLIT = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 };
  var VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

  function vinValue(ch) {
    return /\d/.test(ch) ? Number(ch) : VIN_TRANSLIT[ch] || 0;
  }

  function vinCheckDigit(chars) {
    var soma = 0;
    for (var i = 0; i < 17; i++) soma += vinValue(chars.charAt(i)) * VIN_WEIGHTS[i];
    var rest = soma % 11;
    return rest === 10 ? "X" : String(rest);
  }

  function chassi(rnd) {
    var raw = rnd.chars(17, VIN_ALPHABET);
    var withDv = raw.slice(0, 8) + "0" + raw.slice(9);
    return withDv.slice(0, 8) + vinCheckDigit(withDv) + withDv.slice(9);
  }

  function isValidChassi(value) {
    var v = String(value || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
    if (v.length !== 17 || /[IOQ]/.test(v)) return false;
    return vinCheckDigit(v) === v.charAt(8);
  }

  // -------------------------------------------------------------------
  // Processo judicial (CNJ) — DV mod 97, igual ao IBAN
  // -------------------------------------------------------------------

  function mod97(str) {
    var rest = 0;
    for (var i = 0; i < str.length; i++) rest = (rest * 10 + Number(str.charAt(i))) % 97;
    return rest;
  }

  function processoCNJ(rnd) {
    var numero = rnd.digits(7);
    var ano = String(rnd.int(2015, new Date().getFullYear()));
    var segmento = String(rnd.int(1, 9));
    var tribunal = pad(rnd.int(1, 27), 2);
    var origem = rnd.digits(4);
    var dv = pad(98 - mod97(numero + ano + segmento + tribunal + origem + "00"), 2);
    return numero + "-" + dv + "." + ano + "." + segmento + "." + tribunal + "." + origem;
  }

  function isValidCNJ(value) {
    var v = digits(value);
    if (v.length !== 20) return false;
    var semDv = v.slice(0, 7) + v.slice(9);
    return mod97(semDv + v.slice(7, 9)) === 1;
  }

  // -------------------------------------------------------------------
  // Boleto — linha digitável de 47 posições (padrão Febraban)
  // -------------------------------------------------------------------

  function mod10(block) {
    var soma = 0;
    var factor = 2;
    for (var i = block.length - 1; i >= 0; i--) {
      var n = Number(block.charAt(i)) * factor;
      if (n > 9) n -= 9;
      soma += n;
      factor = factor === 2 ? 1 : 2;
    }
    return String((10 - (soma % 10)) % 10);
  }

  function mod11Barcode(code43) {
    var soma = 0;
    var weight = 2;
    for (var i = code43.length - 1; i >= 0; i--) {
      soma += Number(code43.charAt(i)) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }
    var dv = 11 - (soma % 11);
    // Por norma, 0, 10 e 11 viram 1.
    return dv === 0 || dv === 10 || dv === 11 ? "1" : String(dv);
  }

  function boleto(rnd, opts) {
    opts = opts || {};
    var banco = opts.bank || rnd.pick(["001", "033", "104", "237", "341"]);
    var moeda = "9";
    // Fator de vencimento: dias desde 07/10/1997, base do padrão Febraban.
    var base = Date.UTC(1997, 9, 7);
    var venc = Date.now() + rnd.int(1, 60) * 86400000;
    var fator = pad(Math.floor((venc - base) / 86400000) % 10000, 4);
    var valorCentavos = opts.cents || rnd.int(1000, 999999);
    var valor = pad(valorCentavos, 10);
    var livre = rnd.digits(25);

    var dvGeral = mod11Barcode(banco + moeda + fator + valor + livre);
    var barcode = banco + moeda + dvGeral + fator + valor + livre;

    var campo1 = banco + moeda + livre.slice(0, 5);
    var campo2 = livre.slice(5, 15);
    var campo3 = livre.slice(15, 25);

    var linha =
      campo1 + mod10(campo1) + campo2 + mod10(campo2) + campo3 + mod10(campo3) + dvGeral + fator + valor;

    return {
      barcode: barcode,
      line: linha,
      formatted:
        linha.slice(0, 5) + "." + linha.slice(5, 10) + " " +
        linha.slice(10, 15) + "." + linha.slice(15, 21) + " " +
        linha.slice(21, 26) + "." + linha.slice(26, 32) + " " +
        linha.slice(32, 33) + " " + linha.slice(33),
      amount: valorCentavos / 100
    };
  }

  function isValidBoletoLine(value) {
    var v = digits(value);
    if (v.length !== 47) return false;
    return (
      mod10(v.slice(0, 9)) === v.charAt(9) &&
      mod10(v.slice(10, 20)) === v.charAt(20) &&
      mod10(v.slice(21, 31)) === v.charAt(31)
    );
  }

  // -------------------------------------------------------------------
  // Bancário
  // -------------------------------------------------------------------

  function bankAccount(rnd, bank) {
    var agencia = rnd.digits(4);
    var conta = rnd.digits(rnd.int(5, 8));
    // DV de conta varia por banco; mod 11 base 2..9 é o mais comum.
    var soma = 0;
    var weight = 2;
    for (var i = conta.length - 1; i >= 0; i--) {
      soma += Number(conta.charAt(i)) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }
    var rest = 11 - (soma % 11);
    var dv = rest >= 10 ? "0" : String(rest);
    return {
      bankCode: bank.code,
      bankName: bank.name,
      agency: agencia,
      account: conta + "-" + dv,
      accountRaw: conta + dv
    };
  }

  WC.docs = {
    cpf: cpf,
    cnpj: cnpj,
    pis: pis,
    cnh: cnh,
    titulo: titulo,
    cns: cns,
    renavam: renavam,
    rg: rg,
    inscricaoEstadual: inscricaoEstadual,
    creditCard: creditCard,
    cardBrands: CARD_BRANDS,
    imei: imei,
    ean13: ean13,
    chassi: chassi,
    processoCNJ: processoCNJ,
    boleto: boleto,
    bankAccount: bankAccount,
    luhnCheckDigit: luhnCheckDigit
  };

  WC.validate = {
    cpf: isValidCPF,
    cnpj: isValidCNPJ,
    pis: isValidPIS,
    cnh: isValidCNH,
    titulo: isValidTitulo,
    cns: isValidCNS,
    renavam: isValidRenavam,
    rg: isValidRG,
    inscricaoEstadual: isValidIE,
    luhn: isValidLuhn,
    ean13: isValidEAN13,
    chassi: isValidChassi,
    processoCNJ: isValidCNJ,
    boletoLine: isValidBoletoLine
  };

  if (typeof module !== "undefined" && module.exports) module.exports = { docs: WC.docs, validate: WC.validate };
})(typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : globalThis);
