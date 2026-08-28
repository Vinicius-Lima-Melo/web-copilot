/**
 * Testes dos documentos: round-trip gerador -> validador + valores reais
 * conhecidos. Roda com `node --test tests/` — sem dependência nenhuma.
 */
const test = require("node:test");
const assert = require("node:assert");

require("../scripts/wc-core.js");
require("../scripts/wc-datasets.js");
require("../scripts/wc-docs.js");

const { docs, validate, Random } = globalThis.WC;
const ROUNDS = 500;

function roundTrip(name, generate, isValid) {
  test(`${name}: 500 gerados são todos válidos`, () => {
    for (let i = 0; i < ROUNDS; i++) {
      const rnd = new Random(`seed-${name}-${i}`);
      const value = generate(rnd);
      assert.ok(isValid(value), `${name} inválido gerado: ${JSON.stringify(value)}`);
    }
  });
}

roundTrip("CPF", (r) => docs.cpf(r), validate.cpf);
roundTrip("CPF sem máscara", (r) => docs.cpf(r, { raw: true }), validate.cpf);
roundTrip("CNPJ", (r) => docs.cnpj(r), validate.cnpj);
roundTrip("CNPJ alfanumérico", (r) => docs.cnpj(r, { alphanumeric: true }), validate.cnpj);
roundTrip("PIS", (r) => docs.pis(r), validate.pis);
roundTrip("CNH", (r) => docs.cnh(r), validate.cnh);
roundTrip("Título de eleitor", (r) => docs.titulo(r), validate.titulo);
roundTrip("CNS", (r) => docs.cns(r), validate.cns);
roundTrip("RENAVAM", (r) => docs.renavam(r), validate.renavam);
roundTrip("RG", (r) => docs.rg(r), validate.rg);
roundTrip("Inscrição estadual", (r) => docs.inscricaoEstadual(r), validate.inscricaoEstadual);
roundTrip("IMEI", (r) => docs.imei(r), validate.luhn);
roundTrip("EAN-13", (r) => docs.ean13(r), validate.ean13);
roundTrip("ISBN-13", (r) => docs.ean13(r, { isbn: true }), validate.ean13);
roundTrip("Chassi", (r) => docs.chassi(r), validate.chassi);
roundTrip("Processo CNJ", (r) => docs.processoCNJ(r), validate.processoCNJ);
roundTrip("Cartão de crédito", (r) => docs.creditCard(r).number, validate.luhn);
roundTrip("Cartão formatado", (r) => docs.creditCard(r).formatted, validate.luhn);
roundTrip("Boleto", (r) => docs.boleto(r).line, validate.boletoLine);

test("valores reais conhecidos são aceitos", () => {
  assert.ok(validate.cpf("111.444.777-35"), "CPF de referência");
  assert.ok(validate.cnpj("11.222.333/0001-81"), "CNPJ de referência");
  assert.ok(validate.cnpj("12.ABC.345/01DE-35"), "CNPJ alfanumérico oficial da RFB");
  assert.ok(validate.inscricaoEstadual("110.042.490.114"), "IE de SP de referência");
  assert.ok(validate.ean13("7891000315507"), "EAN-13 de produto real");
  assert.ok(validate.ean13("9780306406157"), "ISBN-13 conhecido");
  assert.ok(validate.luhn("4111111111111111"), "Visa de teste");
  assert.ok(validate.luhn("5555555555554444"), "Mastercard de teste");
  assert.ok(validate.luhn("490154203237518"), "IMEI de teste");
});

test("valores errados são rejeitados", () => {
  assert.ok(!validate.cpf("111.444.777-30"));
  assert.ok(!validate.cpf("111.111.111-11"), "CPF repetido");
  assert.ok(!validate.cpf("123"), "tamanho errado");
  assert.ok(!validate.cnpj("11.222.333/0001-82"));
  assert.ok(!validate.cnpj("00.000.000/0000-00"));
  assert.ok(!validate.ean13("7891000315500"));
  assert.ok(!validate.luhn("4111111111111112"));
  assert.ok(!validate.chassi("9BWZZZ377VT00415I"), "chassi com letra proibida");
  assert.ok(!validate.processoCNJ("0000000-00.2020.8.26.0000"));
});

test("mesma semente gera exatamente os mesmos dados", () => {
  const a = new Random("regressao-42");
  const b = new Random("regressao-42");
  const c = new Random("outra");
  assert.strictEqual(docs.cpf(a), docs.cpf(b));
  assert.notStrictEqual(docs.cpf(new Random("regressao-42")), docs.cpf(c));
});

test("máscaras saem no formato esperado", () => {
  const r = new Random("mascaras");
  assert.match(docs.cpf(r), /^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
  assert.match(docs.cnpj(r), /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
  assert.match(docs.pis(r), /^\d{3}\.\d{5}\.\d{2}-\d$/);
  assert.match(docs.rg(r), /^\d{2}\.\d{3}\.\d{3}-[\dX]$/);
  assert.match(docs.cns(r), /^\d{3} \d{4} \d{4} \d{4}$/);
  assert.match(docs.processoCNJ(r), /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/);
  assert.match(docs.boleto(r).formatted, /^\d{5}\.\d{5} \d{5}\.\d{6} \d{5}\.\d{6} \d \d{14}$/);
});
