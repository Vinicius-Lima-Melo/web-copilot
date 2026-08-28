/**
 * Regressão da detecção. Cada linha é um campo real que já apareceu em
 * formulário brasileiro — inclusive os que a versão anterior errava.
 */
const test = require("node:test");
const assert = require("node:assert");

require("../scripts/wc-core.js");
require("../scripts/wc-datasets.js");
require("../scripts/wc-docs.js");
require("../scripts/wc-persona.js");
require("../scripts/wc-values.js");
require("../scripts/wc-detect.js");

const { detect, values } = globalThis.WC;

/** [sinais, tipo esperado, comentário] */
const CASES = [
  // Documentos e o clássico combo CPF/CNPJ
  [{ label: "CPF" }, "cpf"],
  [{ label: "CNPJ" }, "cnpj"],
  [{ label: "CPF/CNPJ" }, "cpfCnpj", "combo precisa ganhar das regras isoladas"],
  [{ label: "CNPJ ou CPF" }, "cpfCnpj"],
  [{ name: "documento" }, "cpfCnpj"],
  [{ nearby: "Documento (CPF ou CNPJ)" }, "cpfCnpj"],
  [{ name: "titulo", id: "titulo", label: "Título de eleitor" }, "voterId", "não pode virar 'título'"],
  [{ label: "Cartão SUS" }, "cns", "não pode virar cartão de crédito"],
  [{ label: "PIS/PASEP" }, "pis"],
  [{ label: "CNH" }, "cnh"],
  [{ label: "Inscrição estadual" }, "inscricaoEstadual"],

  // Confirmações
  [{ name: "emailConf", id: "emailConf", label: "Confirme o e-mail", inputType: "email" }, "emailConfirm"],
  [{ name: "senhaConf", label: "Confirmar senha", inputType: "password" }, "passwordConfirm"],
  [{ label: "Repetir a senha", inputType: "password" }, "passwordConfirm"],
  [{ label: "Senha atual", inputType: "password" }, "currentPassword"],
  [{ label: "Senha", inputType: "password" }, "password"],

  // Nomes ambíguos
  [{ label: "Nome" }, "fullName"],
  [{ label: "Nome completo" }, "fullName"],
  [{ label: "Nome da mãe" }, "motherName"],
  [{ label: "Nome social" }, "socialName"],
  [{ label: "Razão social" }, "companyName"],
  [{ label: "Nome fantasia" }, "tradeName"],
  [{ label: "Nome de usuário" }, "username"],
  [{ label: "Nome impresso no cartão" }, "cardHolder"],
  [{ label: "Nome do produto" }, "productName"],

  // Número: endereço vs cartão vs processo
  [{ label: "Número" }, "streetNumber"],
  [{ label: "Número do cartão" }, "cardNumber", "não pode virar número do endereço"],
  [{ label: "Número do processo" }, "processNumber"],
  [{ label: "Número da conta" }, "bankAccount"],

  // Contato corporativo não pode virar razão social
  [{ label: "E-mail da empresa" }, "companyEmail"],
  [{ label: "Telefone comercial" }, "companyPhone"],
  [{ label: "Site da empresa" }, "companyWebsite"],
  [{ label: "Razão social" }, "companyName"],

  // Estado / cidade
  [{ label: "Estado" }, "state"],
  [{ label: "UF" }, "state"],
  [{ label: "Estado civil" }, "maritalStatus", "não pode virar UF"],
  [{ label: "Cidade" }, "city"],
  [{ label: "Naturalidade" }, "birthplace"],

  // Telefones
  [{ label: "Telefone" }, "phone"],
  [{ label: "Celular" }, "mobile"],
  [{ label: "Telefone fixo" }, "landline"],
  [{ label: "WhatsApp" }, "whatsapp"],

  // Pagamento
  [{ label: "Validade (MM/AA)" }, "cardExpiry"],
  [{ label: "CVV" }, "cardCvv"],
  [{ label: "Código de segurança" }, "cardCvv"],
  [{ label: "Agência" }, "bankAgency"],
  [{ label: "Chave PIX" }, "pixKey"],
  [{ label: "Linha digitável" }, "boleto"],

  // Datas
  [{ label: "Data de nascimento", inputType: "date" }, "birthday"],
  [{ label: "Data", inputType: "date" }, "date"],
  [{ label: "Idade", inputType: "number" }, "age"],

  // autocomplete padrão manda em tudo
  [{ autocomplete: "shipping postal-code", label: "Qualquer coisa" }, "cep"],
  [{ autocomplete: "cc-number" }, "cardNumber"],
  [{ autocomplete: "one-time-code" }, "otp"],
  [{ autocomplete: "given-name", name: "sobrenome" }, "firstName", "autocomplete tem a última palavra"],

  // Inglês e espanhol
  [{ label: "Full name" }, "fullName"],
  [{ label: "Zip code" }, "cep"],
  [{ label: "Apellido" }, "lastName"],

  // Só o type do input
  [{ inputType: "email" }, "email"],
  [{ inputType: "tel" }, "phone"],
  [{ inputType: "url" }, "website"],

  // Fallbacks
  [{ tagName: "textarea" }, "paragraph"],
  [{ tagName: "select", label: "Plano contratado" }, "@option"],
  [{ tagName: "textarea", label: "Observações" }, "comment"]
];

CASES.forEach(function (item) {
  const [signals, expected, why] = item;
  const title = JSON.stringify(signals) + " -> " + expected + (why ? " (" + why + ")" : "");
  test(title, () => {
    assert.strictEqual(detect.classify(signals).type, expected);
  });
});

const VETOED = [
  { label: "Buscar produto", inputType: "search" },
  { name: "q", placeholder: "Pesquisar" },
  { label: "Cupom de desconto" },
  { label: "Filtrar por período" },
  { name: "honeypot_email" },
  { label: "Digite o captcha" }
];

VETOED.forEach(function (signals) {
  test("vetado: " + JSON.stringify(signals), () => {
    const result = detect.classify(signals);
    assert.ok(result.skip, "deveria ser vetado");
    assert.strictEqual(result.type, null);
  });
});

test("classes utilitárias do Tailwind não influenciam", () => {
  const semClasse = detect.classify({ label: "Bairro" });
  const comClasse = detect.classify({ label: "Bairro", className: "text-sm w-full border rounded px-3" });
  assert.strictEqual(comClasse.type, semClasse.type);
});

test("todo tipo produzido pela detecção tem gerador, rótulo e valor", () => {
  const persona = globalThis.WC.buildPersona({ seed: "cobertura" });
  const rnd = new globalThis.WC.Random("cobertura");
  const known = new Set(values.knownTypes);

  const fromRules = [...new Set(detect.rules.map((r) => r[0]))].filter((t) => t !== detect.SKIP);
  const fromAutocomplete = [...new Set(Object.values(detect.autocompleteMap))];
  const fromInputType = [...new Set(Object.values(detect.inputTypeMap))];

  for (const type of [...fromRules, ...fromAutocomplete, ...fromInputType]) {
    assert.ok(known.has(type), `tipo "${type}" sai da detecção mas não tem gerador`);
    assert.ok(values.labels[type], `tipo "${type}" não tem rótulo`);
    const value = values.valueFor(type, persona, rnd, {});
    assert.ok(value !== null && value !== "", `tipo "${type}" gerou valor vazio`);
  }
});

test("catálogo do menu de contexto está completo e sem órfãos", () => {
  const known = new Set(values.knownTypes);
  const catalog = values.catalog.flatMap((g) => g.types);
  assert.strictEqual(new Set(catalog).size, catalog.length, "tipo repetido no catálogo");
  for (const type of catalog) {
    assert.ok(known.has(type), `catálogo lista "${type}" sem gerador`);
    assert.ok(values.labels[type], `catálogo lista "${type}" sem rótulo`);
  }
  for (const type of known) {
    assert.ok(catalog.includes(type), `gerador "${type}" não aparece no menu`);
  }
});

test("os três modos produzem valor para os tipos principais", () => {
  const persona = globalThis.WC.buildPersona({ seed: "modos" });
  const rnd = new globalThis.WC.Random("modos");
  const principais = ["cpf", "cnpj", "email", "phone", "cep", "birthday", "password", "cardNumber"];

  for (const mode of ["valid", "invalid", "chaos"]) {
    for (const type of principais) {
      const value = values.valueFor(type, persona, rnd, { mode });
      assert.ok(value && value.length > 0, `${type} em modo ${mode} veio vazio`);
    }
  }
});

test("modo inválido realmente reprova nos validadores", () => {
  const { validate } = globalThis.WC;
  const persona = globalThis.WC.buildPersona({ seed: "reprova" });
  const rnd = new globalThis.WC.Random("reprova");
  const pares = [["cpf", validate.cpf], ["cnpj", validate.cnpj], ["pis", validate.pis], ["cnh", validate.cnh], ["cardNumber", validate.luhn]];

  for (const [type, isValid] of pares) {
    assert.ok(isValid(values.valueFor(type, persona, rnd, { mode: "valid" })), `${type} válido deveria passar`);
    assert.ok(!isValid(values.valueFor(type, persona, rnd, { mode: "invalid" })), `${type} inválido deveria reprovar`);
  }
});

test("maxlength curto nunca corta um documento pela metade", () => {
  const persona = globalThis.WC.buildPersona({ seed: "maxlength" });
  const rnd = new globalThis.WC.Random("maxlength");
  const cpf = values.valueFor("cpf", persona, rnd, { maxLength: 11 });
  assert.match(cpf, /^\d{11}$/, "com maxlength 11 o CPF sai sem máscara, não truncado");
  assert.ok(globalThis.WC.validate.cpf(cpf));
});
