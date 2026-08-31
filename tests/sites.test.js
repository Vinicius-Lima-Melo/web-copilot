/**
 * Escopo do autocompletar por site.
 *
 * O caso que motivou o módulo está aqui como teste de regressão: com o
 * autocompletar ligado, a extensão escrevia no compositor do WhatsApp Web.
 */
const test = require("node:test");
const assert = require("node:assert");

require("../scripts/wc-core.js");
require("../scripts/wc-sites.js");

const { sites } = globalThis.WC;

test("host normalizado ignora www, porta e caixa", () => {
  assert.equal(sites.normalizeHost("WWW.Exemplo.com.BR:8080"), "exemplo.com.br");
  assert.equal(sites.normalizeHost(""), "");
});

test("padrão cobre subdomínios, não sufixo parecido", () => {
  assert.ok(sites.hostMatches("checkout.loja.com.br", "loja.com.br"));
  assert.ok(sites.hostMatches("loja.com.br", "loja.com.br"));
  // "malloja.com.br" termina com "loja.com.br" como string, mas é outro site.
  assert.equal(sites.hostMatches("malloja.com.br", "loja.com.br"), false);
});

test("sem site liberado, automático não roda em lugar nenhum", () => {
  assert.equal(sites.canAutofill("qualquer.com", []), false);
  assert.equal(sites.canAutofill("qualquer.com", undefined), false);
});

test("automático roda só no site liberado e nos subdomínios dele", () => {
  const lista = ["loja.com.br"];
  assert.ok(sites.canAutofill("loja.com.br", lista));
  assert.ok(sites.canAutofill("homolog.loja.com.br", lista));
  assert.equal(sites.canAutofill("outro.com", lista), false);
});

test("regressão: WhatsApp nunca autocompleta, nem estando na lista", () => {
  assert.ok(sites.isBlocked("web.whatsapp.com"));
  assert.equal(sites.canAutofill("web.whatsapp.com", ["web.whatsapp.com"]), false);
  assert.equal(sites.canAutofill("web.whatsapp.com", ["whatsapp.com"]), false);
});

test("outros apps de mensagem e rede social também ficam de fora", () => {
  for (const host of ["mail.google.com", "app.slack.com", "web.telegram.org", "x.com", "instagram.com"]) {
    assert.equal(sites.canAutofill(host, [host]), false, host + " deveria estar bloqueado");
  }
});

test("sugestão de padrão usa o domínio registrável", () => {
  assert.equal(sites.suggestPattern("checkout.homolog.loja.com.br"), "loja.com.br");
  assert.equal(sites.suggestPattern("app.exemplo.com"), "exemplo.com");
  assert.equal(sites.suggestPattern("exemplo.com"), "exemplo.com");
  assert.equal(sites.suggestPattern("localhost"), "localhost");
  assert.equal(sites.suggestPattern("192.168.0.10"), "192.168.0.10");
});

test("adicionar é idempotente e remover apaga a entrada que cobre o host", () => {
  let lista = sites.addSite([], "app.loja.com.br");
  assert.deepEqual(lista, ["loja.com.br"]);

  lista = sites.addSite(lista, "checkout.loja.com.br"); // já coberto
  assert.deepEqual(lista, ["loja.com.br"]);

  lista = sites.removeSite(lista, "checkout.loja.com.br");
  assert.deepEqual(lista, []);
});
