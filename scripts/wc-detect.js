/**
 * Web Copilot — detecção do tipo de campo por pontuação.
 *
 * A versão antiga usava "primeira regra da lista que casar", o que obrigava a
 * ordenar as regras à mão e quebrava em casos como "Número do cartão" (casava
 * com `numero` e virava número do endereço). Aqui cada sinal do campo
 * (autocomplete, name, id, label, placeholder, texto vizinho...) tem um peso,
 * cada regra tem uma especificidade, e o tipo vencedor é o de maior soma.
 * Assim "CPF/CNPJ" ganha de "CNPJ" sem depender da ordem.
 *
 * `classify()` recebe um objeto simples de sinais — nada de DOM — para poder
 * ser testado no Node. Só `extractSignals()` toca no elemento.
 */
(function (root) {
  "use strict";

  var WC = (root.WC = root.WC || {});
  var normalize = WC.text.normalize;

  // Peso de cada fonte: quanto mais intencional o sinal, mais ele vale.
  var SOURCE_WEIGHT = {
    name: 10,
    id: 9,
    label: 9,
    aria: 8,
    placeholder: 6,
    dataAttr: 5,
    title: 5,
    nearby: 4,
    className: 2,
    pattern: 3
  };

  /**
   * Tokens do atributo `autocomplete` (padrão WHATWG). Quando o site declara,
   * ele está dizendo exatamente o que quer — vale mais que qualquer heurística.
   */
  var AUTOCOMPLETE_MAP = {
    name: "fullName", "given-name": "firstName", "family-name": "lastName", "additional-name": "middleName",
    nickname: "nickname", username: "username", "new-password": "password", "current-password": "currentPassword",
    "one-time-code": "otp", organization: "companyName", "organization-title": "jobTitle",
    "street-address": "addressFull", "address-line1": "street", "address-line2": "complement",
    "address-line3": "neighborhood", "address-level1": "state", "address-level2": "city",
    "address-level3": "neighborhood", "postal-code": "cep", country: "country", "country-name": "country",
    email: "email", tel: "phone", "tel-national": "phone", "tel-local": "phone", "tel-country-code": "phoneE164",
    bday: "birthday", "bday-day": "integer", "bday-month": "month", "bday-year": "integer",
    sex: "gender", url: "website", "cc-name": "cardHolder", "cc-given-name": "firstName",
    "cc-family-name": "lastName", "cc-number": "cardNumber", "cc-exp": "cardExpiry",
    "cc-exp-month": "cardExpiryMonth", "cc-exp-year": "cardExpiryYear", "cc-csc": "cardCvv", "cc-type": "cardBrand",
    "transaction-amount": "currency", "transaction-currency": "currency"
  };

  /** Tipo derivado do atributo `type` do input, quando nada mais falou mais alto. */
  var INPUT_TYPE_MAP = {
    email: "email", tel: "phone", url: "website", password: "password",
    date: "date", month: "month", week: "week", time: "time", "datetime-local": "datetime",
    color: "color", number: "integer", range: "integer"
  };

  /**
   * [tipo, regex, especificidade]
   * Especificidade alta = expressão que só aparece quando é mesmo aquele campo.
   * Os textos cobrem pt-BR, inglês e espanhol — formulário multi-idioma é regra,
   * não exceção.
   */
  var RULES = [
    // --- Vetos: campos que NÃO devem ser preenchidos ---
    ["@skip", /\bpesquis|\bbusca|\bsearch\b|\bfiltr|\bfilter|\bcupom\b|\bcoupon\b|\bvoucher\b|captcha|honeypot|\bhp[-_]?field\b|\bcaptura\b/, 5],

    // --- Documentos (antes de nome/número, que são genéricos) ---
    ["cpfCnpj", /cpf\s*[\/|e\-_ou]*\s*cnpj|cnpj\s*[\/|e\-_ou]*\s*cpf|\bcpf ou cnpj\b|\bdocumento\b|\bcpf_cnpj\b|\btax ?id\b/, 6],
    ["cnpj", /\bcnpj\b/, 4],
    ["cpf", /\bcpf\b/, 4],
    ["cns", /\bcns\b|cartao ?(nacional de saude|sus)|\bsus\b/, 6],
    ["voterId", /titulo ?(de )?eleitor|titulo ?eleitoral|\bvoter\b/, 6],
    ["pis", /\bpis\b|\bpasep\b|\bnit\b|pis ?pasep/, 5],
    ["cnh", /\bcnh\b|habilitacao|carteira ?de ?motorista|driver ?licen/, 5],
    ["cnhCategory", /categoria ?(da )?cnh|categoria ?habilitacao/, 7],
    ["rg", /\brg\b|registro ?geral|identidade|\bid card\b/, 4],
    ["rgIssuer", /orgao ?(emissor|expedidor)|\bssp\b|emissor/, 6],
    ["passport", /passaporte|passport/, 5],
    ["inscricaoEstadual", /inscricao ?estadual|\bie\b(?! ?mail)/, 5],
    ["inscricaoMunicipal", /inscricao ?municipal|\bim\b/, 5],
    ["processNumber", /processo|\bcnj\b|numero ?do ?processo/, 5],

    // --- Contato ---
    ["emailConfirm", /(confirm|repet|verific|again|segundo|novamente|re-?type|repeat).{0,14}(e-?mail)|(e-?mail).{0,14}(confirm|repet|verific|again|novamente)/, 8],
    ["email", /e-?mail|correio ?eletronico/, 4],
    ["whatsapp", /whats ?app|\bwpp\b|\bzap\b/, 6],
    ["mobile", /celular|\bmobile\b|\bcel\b|movil/, 5],
    ["landline", /telefone ?fixo|\bfixo\b|\blandline\b|residencial/, 5],
    ["phone", /telefone|\bfone\b|\btel\b|\bphone\b|contato ?telefonico|\bddd\b|numero ?de ?contato/, 4],
    ["phoneE164", /telefone ?internacional|country ?code|codigo ?do ?pais/, 6],
    ["website", /\bsite\b|website|\bhomepage\b|pagina ?web|\bportfolio\b/, 4],
    ["url", /\burl\b|\blink\b/, 4],
    ["socialHandle", /instagram|twitter|linkedin|facebook|\bperfil ?social\b|@handle/, 5],

    // --- Identidade ---
    ["motherName", /nome ?(da|de) ?mae|\bmae\b|mother/, 8],
    ["fatherName", /nome ?(do|de) ?pai|\bpai\b|father/, 8],
    ["socialName", /nome ?social|social ?name/, 8],
    ["companyName", /razao ?social|legal ?name|nome ?(da )?empresa|company ?name|\bempresa\b|\bcorporate\b/, 6],
    ["tradeName", /nome ?fantasia|trade ?name|fantasia/, 8],
    ["fullName", /nome ?completo|full ?name|nome ?e ?sobrenome|nombre ?completo/, 6],
    ["firstName", /primeiro ?nome|first ?name|\bfname\b|\bgiven ?name\b|nome ?proprio|\bnome1\b/, 6],
    ["lastName", /sobrenome|ultimo ?nome|last ?name|\blname\b|family ?name|apellido/, 6],
    ["username", /nome ?de ?usuario|\busuario\b|username|\buser\b|\blogin\b|\bnick\b|apelido/, 5],
    ["nickname", /apelido|nickname|como ?prefere/, 5],
    ["fullName", /\bnome\b|\bname\b|\bnombre\b/, 2],
    ["gender", /\bgenero\b|\bsexo\b|\bgender\b/, 5],
    ["maritalStatus", /estado ?civil|marital/, 8],
    ["education", /escolaridade|formacao|education|grau ?de ?instrucao/, 6],
    ["bloodType", /tipo ?sanguineo|fator ?rh|blood/, 7],
    ["nationality", /nacionalidade|nationality/, 6],
    ["birthplace", /naturalidade|cidade ?de ?nascimento|birth ?place/, 7],

    // --- Endereço ---
    ["cep", /\bcep\b|codigo ?postal|postal ?code|\bzip\b/, 6],
    ["neighborhood", /\bbairro\b|neighborhood|distrito/, 6],
    ["complement", /complemento|\bcomplement\b|apartamento|\bapto\b|\bapt\b|address ?line ?2/, 6],
    ["streetNumber", /\bnumero\b|\bnum\b|\bnro\b|\bn°\b|street ?number|numero ?(da )?casa/, 3],
    ["street", /logradouro|endereco|\brua\b|\bavenida\b|\bstreet\b|\baddress\b|direccion|address ?line ?1/, 4],
    ["addressFull", /endereco ?completo|full ?address/, 7],
    ["city", /\bcidade\b|municipio|\bcity\b|localidade|ciudad/, 5],
    ["stateName", /nome ?do ?estado|state ?name/, 7],
    ["state", /\buf\b|\bestado\b|\bstate\b|provincia|\bregiao\b/, 4],
    ["country", /\bpais\b|country|\bnacao\b/, 5],
    ["latitude", /latitude|\blat\b/, 6],
    ["longitude", /longitude|\blng\b|\blon\b/, 6],
    ["ibge", /\bibge\b|codigo ?do ?municipio/, 7],

    // --- Empresa ---
    ["companyEmail", /(e-?mail).{0,12}(empresa|corporativ|comercial)|(empresa|corporativ|comercial).{0,12}(e-?mail)/, 9],
    ["companyPhone", /(telefone|fone).{0,12}(empresa|comercial)|(empresa|comercial).{0,12}(telefone|fone)/, 9],
    ["companyWebsite", /(site|website|pagina).{0,12}(empresa)|(empresa).{0,12}(site|website)/, 9],
    ["jobTitle", /\bcargo\b|profissao|ocupacao|job ?title|\boccupation\b|funcao/, 5],
    ["department", /departamento|\bsetor\b|department/, 5],
    ["salary", /salario|renda|remuneracao|salary|income/, 6],
    ["employees", /funcionarios|colaboradores|employees|porte ?da ?empresa/, 6],

    // --- Acesso ---
    ["passwordConfirm", /(confirm|repet|verific|again|novamente|nueva|re-?type|repeat).{0,14}(senha|password|pass|clave)|(senha|password).{0,14}(confirm|repet|novamente|again)/, 8],
    ["currentPassword", /senha ?atual|current ?password|old ?password|senha ?antiga/, 8],
    ["password", /\bsenha\b|password|\bpwd\b|\bpass\b|\bclave\b/, 4],
    ["pin", /\bpin\b|senha ?numerica|codigo ?de ?4/, 6],
    ["otp", /\botp\b|\btoken\b|codigo ?de ?(verificacao|seguranca|acesso|confirmacao)|verification ?code|one ?time/, 6],

    // --- Pagamento (antes dos genéricos de número) ---
    ["cardNumber", /numero ?do ?cartao|\bcartao\b|card ?number|\bcard\b|\bcc-?num/, 6],
    ["cardHolder", /(titular|nome).{0,14}cartao|card ?holder|nome ?impresso|name ?on ?card/, 8],
    ["cardExpiry", /validade|expiracao|vencimento ?do ?cartao|\bexpiry\b|\bexp ?date\b|\bmm ?\/? ?a{2}\b|\bmm ?\/? ?yy\b/, 7],
    ["cardExpiryMonth", /mes ?(de )?validade|\bexp ?month\b|\bmes\b ?cartao/, 8],
    ["cardExpiryYear", /ano ?(de )?validade|\bexp ?year\b/, 8],
    ["cardCvv", /\bcvv\b|\bcvc\b|\bcsc\b|codigo ?de ?seguranca|security ?code/, 8],
    ["cardBrand", /bandeira|\bbrand\b|\bflag\b ?cartao/, 7],
    ["bankAgency", /\bagencia\b|\bagency\b|\bbranch\b/, 6],
    ["bankAccount", /conta ?(corrente|poupanca|bancaria)|numero ?da ?conta|account ?number|\bconta\b/, 5],
    ["bankName", /\bbanco\b|\bbank\b(?! ?account)/, 5],
    ["bankCode", /codigo ?do ?banco|bank ?code|\bispb\b/, 7],
    ["pixKey", /chave ?pix|\bpix\b/, 7],
    ["boleto", /boleto|linha ?digitavel|codigo ?de ?barras ?do/, 7],
    ["currency", /\bvalor\b|\bpreco\b|\bamount\b|\bprice\b|\btotal\b/, 4],

    // --- Veículo ---
    ["plate", /\bplaca\b|license ?plate|\bplate\b/, 7],
    ["renavam", /renavam/, 9],
    ["chassi", /\bchassi\b|\bchassis\b|\bvin\b/, 8],
    ["vehicleBrand", /marca ?(do )?veiculo|\bmarca\b|\bfabricante\b/, 5],
    ["vehicleModel", /modelo ?(do )?veiculo|\bmodelo\b|\bmodel\b/, 5],
    ["vehicleYear", /ano ?(do )?(veiculo|fabricacao|modelo)|\bano\b|\byear\b/, 4],
    ["vehicleColor", /cor ?(do )?veiculo/, 7],

    // --- Datas ---
    ["birthday", /nascimento|data ?nasc|\bnasc\b|birth ?date|birthdate|\bdob\b|\bbday\b|fecha ?de ?nacimiento/, 7],
    ["age", /\bidade\b|\bage\b|\bedad\b/, 5],
    ["dateFuture", /data ?(de )?(entrega|agendamento|vencimento|previsao)|\bcheck-?in\b|\bcheck-?out\b/, 6],
    ["datePast", /data ?(de )?(admissao|cadastro|emissao|expedicao|abertura)/, 6],
    ["time", /\bhora\b|\bhorario\b|\btime\b(?! ?zone)/, 5],
    ["datetime", /data ?e ?hora|date ?time/, 7],
    ["month", /\bmes\b|\bmonth\b/, 4],
    ["date", /\bdata\b|\bdate\b|\bfecha\b/, 3],

    // --- Números e texto ---
    ["quantity", /quantidade|\bqtd\b|\bqty\b|quantity/, 6],
    ["rating", /\bnota\b|avaliacao|\brating\b|\bestrelas\b/, 6],
    ["weight", /\bpeso\b|\bweight\b|\bkg\b/, 6],
    ["height", /\baltura\b|\bheight\b/, 6],
    ["percent", /percentual|porcentagem|\bpercent\b|\bdesconto\b/, 6],
    ["decimal", /\bdecimal\b|\bfloat\b/, 5],
    ["integer", /\bnumero ?inteiro\b|\binteger\b|\bint\b/, 5],
    ["comment", /coment|\bcomment\b|\bmensagem\b|\bmessage\b|observac|\bobs\b|feedback|\bduvida\b/, 6],
    ["description", /descricao|description|\bdetalhes\b|\bsobre\b|\bbio\b|biografia/, 5],
    ["title", /\btitulo\b(?! ?(de )?eleitor)|\bassunto\b|\bsubject\b|\bheadline\b/, 5],
    ["productName", /\bproduto\b|\bproduct\b|\bitem\b/, 5],
    ["sku", /\bsku\b|codigo ?(do )?produto|\breferencia\b/, 6],
    ["barcode", /codigo ?de ?barras|\bean\b|\bgtin\b|barcode/, 6],
    ["isbn", /\bisbn\b/, 8],
    ["imei", /\bimei\b/, 8],
    ["protocol", /\bprotocolo\b|\bprotocol\b|numero ?de ?atendimento/, 6],
    ["registration", /matricula|\bregistro\b|registration/, 5],
    ["uuid", /\buuid\b|\bguid\b/, 7],
    ["ip", /\bip\b|endereco ?ip/, 6],
    ["mac", /\bmac\b|endereco ?mac/, 6],
    ["color", /\bcor\b|\bcolor\b|\bcolour\b/, 4],
    ["text", /\btexto\b|\btext\b/, 3],

    // --- Marcáveis ---
    ["newsletter", /newsletter|novidades|promoco|receber ?(e-?mails?|comunicados)|marketing|\bofertas\b/, 6],
    ["terms", /\baceit|\bconcordo\b|\btermos\b|privacidade|\bpolitica\b|\bagree\b|\bterms\b|\bconsent/, 5],
    ["optIn", /\bautorizo\b|\bopt-?in\b|\bdeclaro\b|\bciente\b/, 5]
  ];

  var SKIP = "@skip";

  /**
   * Quando um tipo bem específico casa, ele apaga os genéricos que a mesma
   * expressão inevitavelmente também acerta. Sem isto, "Confirme o e-mail"
   * perderia para "email" (que casa em name, id, label E no type=email) e
   * "Título de eleitor" perderia para "título". Suprimir é mais previsível do
   * que ficar calibrando peso contra peso.
   */
  var SUPPRESS = {
    emailConfirm: ["email"],
    passwordConfirm: ["password", "currentPassword"],
    currentPassword: ["password"],
    cpfCnpj: ["cpf", "cnpj"],
    voterId: ["title"],
    cns: ["cardNumber"],
    motherName: ["fullName"],
    fatherName: ["fullName"],
    socialName: ["fullName"],
    tradeName: ["companyName", "fullName"],
    companyName: ["fullName"],
    companyEmail: ["email", "companyName"],
    companyPhone: ["phone", "companyName", "landline"],
    companyWebsite: ["website", "companyName"],
    cardHolder: ["cardNumber", "fullName"],
    cardNumber: ["streetNumber"],
    cardExpiry: ["date", "month"],
    cardExpiryMonth: ["month", "cardExpiry"],
    cardExpiryYear: ["vehicleYear", "cardExpiry"],
    maritalStatus: ["state"],
    stateName: ["state"],
    birthplace: ["city", "birthday"],
    birthday: ["date", "age"],
    bankAccount: ["integer"],
    bankCode: ["bankName"],
    inscricaoEstadual: ["state"],
    inscricaoMunicipal: ["city"],
    processNumber: ["streetNumber"],
    addressFull: ["street"],
    phoneE164: ["phone", "country"],
    whatsapp: ["phone"],
    mobile: ["phone"],
    landline: ["phone"],
    boleto: ["barcode"],
    pixKey: ["bankName"]
  };

  /**
   * Aplica as regras a um texto normalizado e devolve {tipo: pontos}.
   */
  function scoreText(text, weight, scores) {
    if (!text) return;
    for (var i = 0; i < RULES.length; i++) {
      var rule = RULES[i];
      if (rule[1].test(text)) {
        scores[rule[0]] = (scores[rule[0]] || 0) + weight * rule[2];
      }
    }
  }

  /**
   * @param {object} signals { autocomplete, name, id, label, placeholder, aria,
   *                           title, nearby, className, dataAttr, pattern,
   *                           inputType, tagName, maxLength }
   * @returns {{type: string|null, score: number, skip: boolean, runnerUp: string|null}}
   */
  function classify(signals) {
    signals = signals || {};

    // 1) autocomplete declarado pelo site vence tudo.
    var auto = normalize(signals.autocomplete || "");
    if (auto && auto !== "off" && auto !== "on") {
      var tokens = auto.split(/\s+/);
      for (var t = tokens.length - 1; t >= 0; t--) {
        if (AUTOCOMPLETE_MAP[tokens[t]]) {
          return { type: AUTOCOMPLETE_MAP[tokens[t]], score: 1000, skip: false, runnerUp: null, source: "autocomplete" };
        }
      }
    }

    var scores = {};
    var sources = ["name", "id", "label", "aria", "placeholder", "dataAttr", "title", "nearby", "className", "pattern"];
    for (var s = 0; s < sources.length; s++) {
      var key = sources[s];
      scoreText(normalize(signals[key] || ""), SOURCE_WEIGHT[key], scores);
    }

    if (scores[SKIP]) return { type: null, score: scores[SKIP], skip: true, runnerUp: null, source: "skip" };

    // 2) O atributo `type` entra como voto fraco: confirma, mas não manda.
    var byInputType = INPUT_TYPE_MAP[signals.inputType];
    if (byInputType) scores[byInputType] = (scores[byInputType] || 0) + 12;

    // 3) Pistas de tamanho: maxlength 11/14 em campo de documento é bem
    //    característico, mas só desempata (peso baixo de propósito).
    if (signals.maxLength === 11 && scores.cpf) scores.cpf += 8;
    if ((signals.maxLength === 14 || signals.maxLength === 18) && scores.cnpj) scores.cnpj += 8;
    if ((signals.maxLength === 8 || signals.maxLength === 9) && scores.cep) scores.cep += 8;

    // Aplica as supressões antes de eleger o vencedor.
    for (var specific in SUPPRESS) {
      if (!scores[specific]) continue;
      SUPPRESS[specific].forEach(function (generic) { delete scores[generic]; });
    }

    var best = null;
    var bestScore = 0;
    var second = null;
    for (var type in scores) {
      if (!Object.prototype.hasOwnProperty.call(scores, type)) continue;
      if (scores[type] > bestScore) {
        second = best;
        best = type;
        bestScore = scores[type];
      }
    }

    if (!best) {
      // 4) Sem sinal textual: textarea longa recebe texto, o resto fica de fora.
      if (signals.tagName === "textarea") return { type: "paragraph", score: 1, skip: false, runnerUp: null, source: "fallback" };
      // Select sem semântica nenhuma (ex.: "Plano contratado"): qualquer opção
      // real destrava o submit melhor que deixar em "Selecione".
      if (signals.tagName === "select") return { type: "@option", score: 1, skip: false, runnerUp: null, source: "fallback" };
      return { type: null, score: 0, skip: false, runnerUp: null, source: "none" };
    }

    return { type: best, score: bestScore, skip: false, runnerUp: second, source: "rules" };
  }

  WC.detect = {
    classify: classify,
    rules: RULES,
    autocompleteMap: AUTOCOMPLETE_MAP,
    inputTypeMap: INPUT_TYPE_MAP,
    SKIP: SKIP
  };

  if (typeof module !== "undefined" && module.exports) module.exports = WC.detect;
})(typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : globalThis);
