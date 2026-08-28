/**
 * Web Copilot — catálogo de tipos de campo e o valor que cada um produz.
 *
 * Três modos:
 *   valid   -> dado que passa em qualquer validação (o padrão)
 *   invalid -> dado com o dígito verificador/formato quebrado de propósito,
 *              para conferir se a SUA validação realmente reprova
 *   chaos   -> cargas de estresse (XSS, SQL, unicode, tamanho) para conferir
 *              sanitização e limites do seu formulário
 *
 * `ctx` traz só primitivos ({ inputType, maxLength, masked }) para o módulo
 * continuar testável fora do navegador.
 */
(function (root) {
  "use strict";

  var WC = (root.WC = root.WC || {});
  var T = WC.text;

  function digitsOnly(value) {
    return T.onlyDigits(value);
  }

  /** Quando o campo tem máscara própria, mandar só os dígitos evita "((11)) 9999". */
  function maskAware(formatted) {
    return function (p, rnd, ctx) {
      var value = typeof formatted === "function" ? formatted(p, rnd, ctx) : formatted;
      return ctx && ctx.masked ? digitsOnly(value) : value;
    };
  }

  function fromPersona(path) {
    return function (p) {
      var parts = path.split(".");
      var value = p;
      for (var i = 0; i < parts.length && value != null; i++) value = value[parts[i]];
      return value === null || value === undefined ? "" : String(value);
    };
  }

  function numeric(path) {
    return function (p, rnd, ctx) {
      var raw = fromPersona(path)(p, rnd, ctx);
      return ctx && ctx.inputType === "number" ? raw.replace(/[^\d.,-]/g, "").replace(",", ".") : raw;
    };
  }

  // -------------------------------------------------------------------
  // Geradores no modo válido
  // -------------------------------------------------------------------

  var VALID = {
    // Identidade
    fullName: fromPersona("fullName"),
    firstName: fromPersona("firstName"),
    lastName: fromPersona("lastName"),
    middleName: fromPersona("middleName"),
    socialName: fromPersona("fullName"),
    nickname: fromPersona("nickname"),
    username: fromPersona("username"),
    initials: fromPersona("initials"),
    motherName: fromPersona("motherName"),
    fatherName: fromPersona("fatherName"),
    gender: fromPersona("genderLabel"),
    maritalStatus: fromPersona("maritalStatus"),
    education: fromPersona("education"),
    bloodType: fromPersona("bloodType"),
    nationality: fromPersona("nationality"),
    birthplace: fromPersona("birthplace"),

    // Contato
    email: fromPersona("email"),
    emailConfirm: fromPersona("email"),
    emailAlt: fromPersona("emailAlt"),
    phone: maskAware(fromPersona("phone")),
    mobile: maskAware(fromPersona("mobile")),
    landline: maskAware(fromPersona("landline")),
    whatsapp: maskAware(fromPersona("mobile")),
    phoneE164: fromPersona("phoneE164"),
    website: fromPersona("website"),
    socialHandle: fromPersona("social"),

    // Documentos
    cpf: maskAware(fromPersona("cpf")),
    cnpj: maskAware(fromPersona("cnpj")),
    cpfCnpj: function (p, rnd, ctx) {
      // Campo combinado: respeita o maxlength quando ele já denuncia qual dos dois cabe.
      var wantsCnpj = ctx && ctx.maxLength ? ctx.maxLength >= 18 || ctx.maxLength === 14 : rnd.bool(0.4);
      var value = wantsCnpj ? p.cnpj : p.cpf;
      return ctx && ctx.masked ? digitsOnly(value) : value;
    },
    cnpjAlfa: fromPersona("company.cnpjAlfa"),
    rg: maskAware(fromPersona("rg")),
    rgIssuer: fromPersona("rgIssuer"),
    cnh: fromPersona("cnh"),
    cnhCategory: fromPersona("cnhCategory"),
    pis: maskAware(fromPersona("pis")),
    cns: maskAware(fromPersona("cns")),
    voterId: fromPersona("voterId"),
    passport: fromPersona("passport"),
    inscricaoEstadual: maskAware(fromPersona("inscricaoEstadual")),
    inscricaoMunicipal: fromPersona("inscricaoMunicipal"),
    processNumber: fromPersona("misc.processNumber"),

    // Endereço
    cep: maskAware(fromPersona("address.zip")),
    street: fromPersona("address.street"),
    streetNumber: fromPersona("address.number"),
    complement: fromPersona("address.complement"),
    neighborhood: fromPersona("address.neighborhood"),
    city: fromPersona("address.city"),
    state: fromPersona("address.state"),
    stateName: fromPersona("address.stateName"),
    country: fromPersona("address.country"),
    addressFull: function (p) {
      return p.address.street + ", " + p.address.number + " - " + p.address.neighborhood +
        ", " + p.address.city + "/" + p.address.state;
    },
    latitude: fromPersona("address.latitude"),
    longitude: fromPersona("address.longitude"),
    ibge: fromPersona("address.ibge"),

    // Empresa
    companyName: fromPersona("company.name"),
    tradeName: fromPersona("company.tradeName"),
    companyEmail: fromPersona("company.email"),
    companyPhone: maskAware(fromPersona("company.phone")),
    companyWebsite: fromPersona("company.website"),
    jobTitle: fromPersona("company.jobTitle"),
    department: fromPersona("company.department"),
    salary: function (p, rnd, ctx) {
      return ctx && ctx.inputType === "number" ? p.company.salary.toFixed(2) : p.company.salaryFormatted;
    },
    employees: fromPersona("company.employees"),

    // Acesso
    password: fromPersona("password"),
    passwordConfirm: fromPersona("password"),
    currentPassword: fromPersona("password"),
    pin: fromPersona("pin"),
    otp: fromPersona("otp"),

    // Pagamento
    cardNumber: maskAware(fromPersona("card.number")),
    cardHolder: fromPersona("card.holder"),
    cardExpiry: function (p, rnd, ctx) {
      if (ctx && ctx.inputType === "month") return p.card.expiryYear + "-" + p.card.expiryMonth;
      if (ctx && ctx.maxLength === 7) return p.card.expiryLong;
      return ctx && ctx.masked ? digitsOnly(p.card.expiry) : p.card.expiry;
    },
    cardExpiryMonth: fromPersona("card.expiryMonth"),
    cardExpiryYear: fromPersona("card.expiryYear"),
    cardCvv: fromPersona("card.cvv"),
    cardBrand: fromPersona("card.brand"),
    bankCode: fromPersona("bank.code"),
    bankName: fromPersona("bank.name"),
    bankAgency: fromPersona("bank.agency"),
    bankAccount: fromPersona("bank.account"),
    pixKey: fromPersona("bank.pixKey"),
    boleto: maskAware(fromPersona("bank.boleto")),
    currency: function (p, rnd, ctx) {
      return ctx && ctx.inputType === "number" ? p.misc.price.toFixed(2) : p.misc.priceFormatted;
    },

    // Veículo
    plate: fromPersona("vehicle.plate"),
    plateOld: fromPersona("vehicle.plateOld"),
    renavam: fromPersona("vehicle.renavam"),
    chassi: fromPersona("vehicle.chassi"),
    vehicleBrand: fromPersona("vehicle.brand"),
    vehicleModel: fromPersona("vehicle.model"),
    vehicleYear: fromPersona("vehicle.year"),
    vehicleColor: fromPersona("vehicle.color"),

    // Datas
    birthday: function (p, rnd, ctx) {
      var type = ctx && ctx.inputType;
      if (type === "date") return p.birthDate;
      if (type === "month") return p.birthDate.slice(0, 7);
      if (p.meta.locale === "US") return p.birthDateUS;
      return ctx && ctx.masked ? digitsOnly(p.birthDateBR) : p.birthDateBR;
    },
    age: numeric("age"),
    date: function (p, rnd, ctx) {
      var d = new Date();
      d.setDate(d.getDate() - rnd.int(0, 365));
      return formatDate(d, ctx, p);
    },
    dateFuture: function (p, rnd, ctx) {
      var d = new Date();
      d.setDate(d.getDate() + rnd.int(1, 365));
      return formatDate(d, ctx, p);
    },
    datePast: function (p, rnd, ctx) {
      var d = new Date();
      d.setDate(d.getDate() - rnd.int(30, 3650));
      return formatDate(d, ctx, p);
    },
    time: fromPersona("misc.time"),
    datetime: function (p, rnd) {
      var d = new Date();
      d.setDate(d.getDate() + rnd.int(1, 30));
      return WC.personaHelpers.isoDate(d) + "T" + p.misc.time;
    },
    month: function (p, rnd) {
      return String(new Date().getFullYear()) + "-" + T.pad(rnd.int(1, 12), 2);
    },
    week: function (p, rnd) {
      return String(new Date().getFullYear()) + "-W" + T.pad(rnd.int(1, 52), 2);
    },

    // Números e texto
    integer: function (p, rnd) { return String(rnd.int(1, 9999)); },
    decimal: function (p, rnd) { return (rnd.int(100, 99999) / 100).toFixed(2); },
    percent: fromPersona("misc.percent"),
    quantity: fromPersona("misc.quantity"),
    rating: fromPersona("misc.rating"),
    weight: function (p, rnd) { return (rnd.int(500, 1200) / 10).toFixed(1); },
    height: function (p, rnd) { return (rnd.int(150, 200) / 100).toFixed(2); },
    title: fromPersona("misc.title"),
    text: fromPersona("misc.text"),
    paragraph: fromPersona("misc.paragraph"),
    comment: fromPersona("misc.text"),
    description: fromPersona("misc.paragraph"),
    productName: fromPersona("misc.product"),
    sku: fromPersona("misc.sku"),
    barcode: fromPersona("misc.barcode"),
    isbn: fromPersona("misc.isbn"),
    imei: fromPersona("misc.imei"),
    protocol: fromPersona("misc.protocol"),
    registration: fromPersona("misc.registration"),
    uuid: fromPersona("misc.uuid"),
    ip: fromPersona("misc.ip"),
    mac: fromPersona("misc.mac"),
    color: fromPersona("misc.color"),
    url: fromPersona("website"),

    // Booleanos
    terms: function () { return "true"; },
    newsletter: function () { return "true"; },
    optIn: function () { return "true"; }
  };

  function formatDate(date, ctx, persona) {
    var type = ctx && ctx.inputType;
    if (type === "date") return WC.personaHelpers.isoDate(date);
    if (persona && persona.meta.locale === "US") return WC.personaHelpers.usDate(date);
    var value = WC.personaHelpers.brDate(date);
    return ctx && ctx.masked ? digitsOnly(value) : value;
  }

  // -------------------------------------------------------------------
  // Modo inválido — quebra o DV/formato de propósito
  // -------------------------------------------------------------------

  function breakLastDigit(value) {
    var chars = value.split("");
    for (var i = chars.length - 1; i >= 0; i--) {
      if (/\d/.test(chars[i])) {
        chars[i] = String((Number(chars[i]) + 5) % 10);
        return chars.join("");
      }
    }
    return value + "0";
  }

  var INVALID = {
    cpf: function (p) { return breakLastDigit(p.cpf); },
    cnpj: function (p) { return breakLastDigit(p.cnpj); },
    cpfCnpj: function (p) { return breakLastDigit(p.cpf); },
    rg: function (p) { return breakLastDigit(p.rg); },
    cnh: function (p) { return breakLastDigit(p.cnh); },
    pis: function (p) { return breakLastDigit(p.pis); },
    cns: function (p) { return breakLastDigit(p.cns); },
    voterId: function (p) { return breakLastDigit(p.voterId); },
    inscricaoEstadual: function (p) { return breakLastDigit(p.inscricaoEstadual); },
    renavam: function (p) { return breakLastDigit(p.vehicle.renavam); },
    chassi: function (p) { return p.vehicle.chassi.slice(0, 16) + "I"; },
    barcode: function (p) { return breakLastDigit(p.misc.barcode); },
    imei: function (p) { return breakLastDigit(p.misc.imei); },
    cardNumber: function (p) { return breakLastDigit(p.card.numberRaw); },
    boleto: function (p) { return breakLastDigit(p.bank.boleto); },
    processNumber: function (p) { return breakLastDigit(p.misc.processNumber); },
    email: function (p, rnd) { return rnd.pick(["sem-arroba.invalid", "duplo@@teste.invalid", "espaco no meio@teste.invalid", "@semlocal.invalid", "final@"]); },
    emailConfirm: function (p) { return "outro." + p.email; },
    phone: function (p, rnd) { return rnd.pick(["(00) 0000-0000", "123", "(11) 12345", "abcdefghij"]); },
    mobile: function (p, rnd) { return rnd.pick(["(11) 1234-5678", "999999999999999"]); },
    cep: function (p, rnd) { return rnd.pick(["00000-000", "1234", "abcde-fgh"]); },
    password: function (p, rnd) { return rnd.pick(["123", "senha", "aaaaaa", " "]); },
    passwordConfirm: function (p) { return p.password + "-diferente"; },
    birthday: function (p, rnd, ctx) {
      // Data de nascimento no futuro: o clássico que passa despercebido.
      var d = new Date();
      d.setFullYear(d.getFullYear() + rnd.int(1, 5));
      return formatDate(d, ctx, p);
    },
    age: function (p, rnd) { return rnd.pick(["-1", "0", "999", "abc"]); },
    state: function () { return "ZZ"; },
    plate: function () { return "AAA0000000"; },
    cardExpiry: function () { return "13/99"; },
    cardCvv: function () { return "0"; },
    url: function () { return "htp:/invalido..com"; },
    currency: function (p, rnd) { return rnd.pick(["-100,00", "0", "abc", "1,,5"]); }
  };

  // -------------------------------------------------------------------
  // API
  // -------------------------------------------------------------------

  function chaosValue(rnd, ctx) {
    var payload = rnd.pick(WC.datasets.BR.chaosPayloads);
    // Se o campo tem maxlength curto, uma carga de 1024 chars vira só "AAA".
    // Corta para caber e ainda assim exercitar o limite (maxlength + 1).
    if (ctx && ctx.maxLength > 0 && payload.length > ctx.maxLength) {
      payload = payload.slice(0, ctx.maxLength);
    }
    return payload;
  }

  /**
   * @param {string} type   tipo canônico do campo
   * @param {object} persona
   * @param {object} rnd    WC.Random
   * @param {object} ctx    { inputType, maxLength, masked, mode }
   * @returns {string|null} null quando o tipo não é conhecido
   */
  function valueFor(type, persona, rnd, ctx) {
    ctx = ctx || {};
    var mode = ctx.mode || "valid";

    if (mode === "chaos") {
      // Booleanos não têm o que estressar: marcar continua sendo marcar.
      if (type === "terms" || type === "newsletter" || type === "optIn") return "true";
      return chaosValue(rnd, ctx);
    }

    if (mode === "invalid" && INVALID[type]) return String(INVALID[type](persona, rnd, ctx));

    var generator = VALID[type];
    if (!generator) return null;
    var value = generator(persona, rnd, ctx);
    if (value === null || value === undefined) return null;
    value = String(value);

    // Respeita maxlength: valor truncado no meio é pior que valor sem máscara.
    if (ctx.maxLength > 0 && value.length > ctx.maxLength) {
      var stripped = digitsOnly(value);
      if (stripped && stripped.length <= ctx.maxLength && stripped.length > 0) return stripped;
      return value.slice(0, ctx.maxLength);
    }
    return value;
  }

  /** Catálogo exibido no popup e no menu de contexto. */
  var CATALOG = [
    { group: "Identidade", types: ["fullName", "firstName", "middleName", "lastName", "initials", "socialName", "nickname", "username", "motherName", "fatherName", "gender", "maritalStatus", "education", "bloodType", "nationality", "birthplace"] },
    { group: "Contato", types: ["email", "emailConfirm", "emailAlt", "phone", "mobile", "landline", "whatsapp", "phoneE164", "website", "socialHandle"] },
    { group: "Documentos", types: ["cpf", "cnpj", "cpfCnpj", "cnpjAlfa", "rg", "rgIssuer", "cnh", "cnhCategory", "pis", "cns", "voterId", "passport", "inscricaoEstadual", "inscricaoMunicipal", "processNumber"] },
    { group: "Endereço", types: ["cep", "street", "streetNumber", "complement", "neighborhood", "city", "state", "stateName", "country", "addressFull", "latitude", "longitude", "ibge"] },
    { group: "Empresa", types: ["companyName", "tradeName", "companyEmail", "companyPhone", "companyWebsite", "jobTitle", "department", "salary", "employees"] },
    { group: "Acesso", types: ["password", "passwordConfirm", "currentPassword", "pin", "otp"] },
    { group: "Pagamento", types: ["cardNumber", "cardHolder", "cardExpiry", "cardExpiryMonth", "cardExpiryYear", "cardCvv", "cardBrand", "bankCode", "bankName", "bankAgency", "bankAccount", "pixKey", "boleto", "currency"] },
    { group: "Veículo", types: ["plate", "plateOld", "renavam", "chassi", "vehicleBrand", "vehicleModel", "vehicleYear", "vehicleColor"] },
    { group: "Datas", types: ["birthday", "age", "date", "dateFuture", "datePast", "time", "datetime", "month", "week"] },
    { group: "Números", types: ["integer", "decimal", "percent", "quantity", "rating", "weight", "height"] },
    { group: "Texto e códigos", types: ["title", "text", "paragraph", "comment", "description", "productName", "sku", "barcode", "isbn", "imei", "protocol", "registration", "uuid", "ip", "mac", "color", "url"] },
    { group: "Marcáveis", types: ["terms", "newsletter", "optIn"] }
  ];

  var LABELS = {
    fullName: "Nome completo", firstName: "Primeiro nome", lastName: "Sobrenome", middleName: "Nome do meio",
    socialName: "Nome social", nickname: "Apelido", username: "Usuário", initials: "Iniciais",
    motherName: "Nome da mãe", fatherName: "Nome do pai", gender: "Gênero", maritalStatus: "Estado civil",
    education: "Escolaridade", bloodType: "Tipo sanguíneo", nationality: "Nacionalidade", birthplace: "Naturalidade",
    email: "E-mail", emailConfirm: "Confirmação de e-mail", emailAlt: "E-mail alternativo", phone: "Telefone",
    mobile: "Celular", landline: "Telefone fixo", whatsapp: "WhatsApp", phoneE164: "Telefone internacional",
    website: "Site", socialHandle: "Perfil social",
    cpf: "CPF", cnpj: "CNPJ", cpfCnpj: "CPF/CNPJ", cnpjAlfa: "CNPJ alfanumérico", rg: "RG", rgIssuer: "Órgão emissor",
    cnh: "CNH", cnhCategory: "Categoria da CNH", pis: "PIS/PASEP", cns: "Cartão SUS (CNS)", voterId: "Título de eleitor",
    passport: "Passaporte", inscricaoEstadual: "Inscrição estadual", inscricaoMunicipal: "Inscrição municipal",
    processNumber: "Processo judicial",
    cep: "CEP", street: "Logradouro", streetNumber: "Número", complement: "Complemento", neighborhood: "Bairro",
    city: "Cidade", state: "UF", stateName: "Estado", country: "País", addressFull: "Endereço completo",
    latitude: "Latitude", longitude: "Longitude", ibge: "Código IBGE",
    companyName: "Razão social", tradeName: "Nome fantasia", companyEmail: "E-mail da empresa",
    companyPhone: "Telefone da empresa", companyWebsite: "Site da empresa", jobTitle: "Cargo",
    department: "Departamento", salary: "Salário", employees: "Nº de funcionários",
    password: "Senha", passwordConfirm: "Confirmação de senha", currentPassword: "Senha atual", pin: "PIN", otp: "Código OTP",
    cardNumber: "Número do cartão", cardHolder: "Titular do cartão", cardExpiry: "Validade do cartão",
    cardExpiryMonth: "Mês de validade", cardExpiryYear: "Ano de validade", cardCvv: "CVV", cardBrand: "Bandeira",
    bankCode: "Código do banco", bankName: "Banco", bankAgency: "Agência", bankAccount: "Conta",
    pixKey: "Chave PIX", boleto: "Linha digitável", currency: "Valor em R$",
    plate: "Placa (Mercosul)", plateOld: "Placa (modelo antigo)", renavam: "RENAVAM", chassi: "Chassi",
    vehicleBrand: "Marca do veículo", vehicleModel: "Modelo", vehicleYear: "Ano", vehicleColor: "Cor do veículo",
    birthday: "Data de nascimento", age: "Idade", date: "Data", dateFuture: "Data futura", datePast: "Data passada",
    time: "Hora", datetime: "Data e hora", month: "Mês", week: "Semana",
    integer: "Número inteiro", decimal: "Número decimal", percent: "Percentual", quantity: "Quantidade",
    rating: "Avaliação", weight: "Peso", height: "Altura",
    title: "Título", text: "Texto curto", paragraph: "Parágrafo", comment: "Comentário", description: "Descrição", productName: "Produto",
    sku: "SKU", barcode: "Código de barras", isbn: "ISBN", imei: "IMEI", protocol: "Protocolo",
    registration: "Matrícula", uuid: "UUID", ip: "Endereço IP", mac: "Endereço MAC", color: "Cor", url: "URL",
    terms: "Aceite de termos", newsletter: "Newsletter", optIn: "Opt-in",
    "@option": "Opção qualquer"
  };

  WC.values = {
    valueFor: valueFor,
    catalog: CATALOG,
    labels: LABELS,
    label: function (type) { return LABELS[type] || type; },
    knownTypes: Object.keys(VALID)
  };

  if (typeof module !== "undefined" && module.exports) module.exports = WC.values;
})(typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : globalThis);
