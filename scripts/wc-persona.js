/**
 * Web Copilot — persona coerente + catálogo de valores por tipo de campo.
 *
 * A persona é gerada UMA vez e compartilhada por todos os campos da página
 * (e por todos os iframes). Isso é o que separa "preencheu tudo" de
 * "preencheu um cadastro que passa na validação": o e-mail deriva do nome,
 * o DDD vem da cidade, o CEP vem da região da cidade, "confirmar senha"
 * bate com "senha" e o nome da mãe compartilha o sobrenome.
 */
(function (root) {
  "use strict";

  var WC = (root.WC = root.WC || {});
  var T = WC.text;
  var pad = T.pad;

  // -------------------------------------------------------------------
  // Persona
  // -------------------------------------------------------------------

  function pickPerson(rnd, data, locale) {
    var gender = rnd.weighted([["F", 5], ["M", 5], ["X", 0.2]]);
    var pool = gender === "M" ? data.firstNamesM : data.firstNamesF;
    var firstName = rnd.pick(pool);
    var lastName = rnd.pick(data.lastNames);
    // "Ricardo Martins Martins" não convence ninguém: garante sobrenomes distintos.
    var familyName = rnd.pick(data.lastNames.filter(function (n) { return n !== lastName; }));
    var full = locale === "US"
      ? firstName + " " + lastName
      : firstName + " " + lastName + " " + familyName;
    return {
      gender: gender,
      genderLabel: gender === "M" ? "Masculino" : gender === "F" ? "Feminino" : "Outro",
      firstName: firstName,
      lastName: familyName,
      middleName: lastName,
      fullName: full,
      surnames: [lastName, familyName]
    };
  }

  function birthFor(rnd, minAge, maxAge) {
    var today = new Date();
    var age = rnd.int(minAge, maxAge);
    var date = new Date(today.getFullYear() - age, rnd.int(0, 11), rnd.int(1, 28));
    var realAge = today.getFullYear() - date.getFullYear();
    var m = today.getMonth() - date.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < date.getDate())) realAge--;
    return { date: date, age: realAge };
  }

  function isoDate(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1, 2) + "-" + pad(date.getDate(), 2);
  }

  function brDate(date) {
    return pad(date.getDate(), 2) + "/" + pad(date.getMonth() + 1, 2) + "/" + date.getFullYear();
  }

  function usDate(date) {
    return pad(date.getMonth() + 1, 2) + "/" + pad(date.getDate(), 2) + "/" + date.getFullYear();
  }

  function makePassword(rnd) {
    var upper = rnd.chars(1, "ABCDEFGHJKLMNPQRSTUVWXYZ");
    var lower = rnd.chars(6, "abcdefghijkmnpqrstuvwxyz");
    var nums = rnd.digits(3);
    var symbol = rnd.pick(["!", "@", "#", "$", "%", "&", "*", "?"]);
    return rnd.shuffle((upper + lower + nums + symbol).split("")).join("");
  }

  function makePlate(rnd, mercosul) {
    var letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (mercosul === false) return rnd.chars(3, letters) + "-" + rnd.digits(4);
    return rnd.chars(3, letters) + rnd.digits(1) + rnd.chars(1, letters) + rnd.digits(2);
  }

  function lorem(rnd, words, wordPool) {
    var out = [];
    for (var i = 0; i < words; i++) out.push(rnd.pick(wordPool));
    return T.capitalize(out.join(" ")) + ".";
  }

  function money(rnd, min, max) {
    return rnd.int(min * 100, max * 100) / 100;
  }

  function formatBRL(value) {
    return "R$ " + value.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  /**
   * @param {object} options { seed, locale: 'BR'|'US', minAge, maxAge }
   */
  function buildPersona(options) {
    options = options || {};
    var locale = options.locale === "US" ? "US" : "BR";
    var seed = options.seed || null;
    var rnd = new WC.Random(seed);
    var data = locale === "US" ? WC.datasets.US : WC.datasets.BR;
    var br = WC.datasets.BR;
    var docs = WC.docs;

    var person = pickPerson(rnd, data, locale);
    var birth = birthFor(rnd, options.minAge || 18, options.maxAge || 70);
    var place = rnd.pick(data.cities);

    var localPart = T.slugify(person.firstName + "." + person.lastName).replace(/-/g, ".");
    var username = localPart.replace(/\./g, "") + rnd.digits(3);
    var domain = rnd.pick(data.emailDomains);

    var mother = rnd.pick(br.firstNamesF) + " " + person.middleName + " " + person.lastName;
    var father = rnd.pick(br.firstNamesM) + " " + person.middleName + " " + person.lastName;

    var bank = rnd.pick(br.banks);
    var account = docs.bankAccount(rnd, bank);
    var card = docs.creditCard(rnd);
    var expiry = new Date(new Date().getFullYear() + rnd.int(1, 6), rnd.int(0, 11), 1);

    var companyBase = rnd.pick(br.companyPrefixes) + rnd.pick(br.companyCores);
    var companyName = companyBase + " " + rnd.pick(br.companySegments) + " " + rnd.pick(br.companyLegal);
    var companyDomain = T.slugify(companyBase) + ".invalid";

    var car = rnd.pick(br.carBrands);
    var street = locale === "US"
      ? rnd.pick(data.streetNames) + " " + rnd.pick(data.streetTypes)
      : rnd.pick(data.streetTypes) + " " + rnd.pick(data.streetNames);

    var cep = locale === "US"
      ? place.zip + rnd.digits(2)
      : place.cep + rnd.digits(2) + "-" + rnd.digits(3);

    var mobile = locale === "US"
      ? "(" + place.area + ") " + rnd.digits(3) + "-" + rnd.digits(4)
      : "(" + place.ddd + ") 9" + rnd.digits(4) + "-" + rnd.digits(4);
    var landline = locale === "US"
      ? "(" + place.area + ") " + rnd.digits(3) + "-" + rnd.digits(4)
      : "(" + place.ddd + ") " + rnd.pick(["2", "3", "4"]) + rnd.digits(3) + "-" + rnd.digits(4);

    var stateInfo = br.states.filter(function (s) { return s.sigla === place.state; })[0];

    var persona = {
      meta: {
        seed: seed,
        locale: locale,
        createdAt: new Date().toISOString(),
        version: WC.VERSION
      },

      gender: person.gender,
      genderLabel: person.genderLabel,
      firstName: person.firstName,
      middleName: person.middleName,
      lastName: person.lastName,
      fullName: person.fullName,
      initials: person.fullName.split(" ").map(function (p) { return p.charAt(0); }).join(""),
      nickname: T.capitalize(person.firstName.toLowerCase()) + rnd.digits(2),
      username: username,
      motherName: mother,
      fatherName: father,

      birthDate: isoDate(birth.date),
      birthDateBR: brDate(birth.date),
      birthDateUS: usDate(birth.date),
      age: birth.age,
      bloodType: rnd.pick(br.bloodTypes),
      maritalStatus: rnd.pick(br.maritalStatus),
      education: rnd.pick(br.education),
      nationality: locale === "US" ? "American" : "Brasileira",
      birthplace: place.city + " - " + place.state,

      email: localPart + rnd.digits(2) + "@" + domain,
      emailAlt: username + "@" + rnd.pick(data.emailDomains),
      password: makePassword(rnd),
      pin: rnd.digits(4),
      otp: rnd.digits(6),
      website: "https://" + T.slugify(person.firstName + person.lastName) + ".invalid",
      social: "@" + username,

      phone: mobile,
      mobile: mobile,
      landline: landline,
      phoneRaw: T.onlyDigits(mobile),
      phoneE164: locale === "US" ? "+1" + T.onlyDigits(mobile) : "+55" + T.onlyDigits(mobile),

      cpf: docs.cpf(rnd),
      cpfRaw: null,
      cnpj: docs.cnpj(rnd),
      rg: docs.rg(rnd),
      rgIssuer: "SSP-" + place.state,
      cnh: docs.cnh(rnd),
      cnhCategory: rnd.pick(["A", "B", "AB", "C", "D"]),
      pis: docs.pis(rnd),
      cns: docs.cns(rnd),
      voterId: docs.titulo(rnd),
      passport: rnd.chars(2, "ABCDEFGHJKLMNPQRSTUVWXYZ") + rnd.digits(6),
      inscricaoEstadual: docs.inscricaoEstadual(rnd),
      inscricaoMunicipal: rnd.digits(11),

      address: {
        zip: cep,
        street: street,
        number: String(rnd.int(1, 2500)),
        complement: rnd.pick(br.complements),
        neighborhood: rnd.pick(br.neighborhoods),
        city: place.city,
        state: place.state,
        stateName: stateInfo ? stateInfo.nome : place.state,
        country: locale === "US" ? "United States" : "Brasil",
        countryCode: locale === "US" ? "US" : "BR",
        ibge: place.ibge || "",
        areaCode: place.ddd || place.area,
        latitude: rnd.float(-33.7, 5.2).toFixed(6),
        longitude: rnd.float(-73.9, -34.8).toFixed(6)
      },

      company: {
        name: companyName,
        tradeName: companyBase,
        cnpj: docs.cnpj(rnd),
        cnpjAlfa: docs.cnpj(rnd, { alphanumeric: true }),
        inscricaoEstadual: docs.inscricaoEstadual(rnd),
        email: "contato@" + companyDomain,
        website: "https://" + companyDomain,
        phone: landline,
        department: rnd.pick(br.departments),
        jobTitle: rnd.pick(br.jobTitles),
        salary: money(rnd, 1800, 25000),
        employees: rnd.int(3, 5000)
      },

      card: {
        brand: card.brand,
        number: card.formatted,
        numberRaw: card.number,
        cvv: card.cvv,
        expiry: pad(expiry.getMonth() + 1, 2) + "/" + String(expiry.getFullYear()).slice(2),
        expiryLong: pad(expiry.getMonth() + 1, 2) + "/" + expiry.getFullYear(),
        expiryMonth: pad(expiry.getMonth() + 1, 2),
        expiryYear: String(expiry.getFullYear()),
        holder: T.deburr(person.fullName).toUpperCase()
      },

      bank: {
        code: account.bankCode,
        name: account.bankName,
        agency: account.agency,
        account: account.account,
        pixKey: rnd.pick([rnd.uuid(), localPart + rnd.digits(2) + "@" + domain, T.onlyDigits(mobile)]),
        boleto: docs.boleto(rnd).formatted
      },

      vehicle: {
        brand: car.brand,
        model: rnd.pick(car.models),
        year: String(rnd.int(2010, new Date().getFullYear())),
        color: rnd.pick(br.colors),
        plate: makePlate(rnd, true),
        plateOld: makePlate(rnd, false),
        renavam: docs.renavam(rnd),
        chassi: docs.chassi(rnd)
      },

      misc: {
        uuid: rnd.uuid(),
        protocol: String(new Date().getFullYear()) + rnd.digits(8),
        registration: rnd.digits(6),
        processNumber: docs.processoCNJ(rnd),
        barcode: docs.ean13(rnd),
        isbn: docs.ean13(rnd, { isbn: true }),
        imei: docs.imei(rnd),
        ip: rnd.pick(["192.0.2.", "198.51.100.", "203.0.113."]) + rnd.int(1, 254),
        mac: "02:" + [0, 0, 0, 0, 0].map(function () { return rnd.chars(2, "0123456789ABCDEF"); }).join(":"),
        color: "#" + rnd.chars(6, "0123456789abcdef"),
        product: rnd.pick(br.products),
        sku: rnd.chars(3, "ABCDEFGHJKLMNPQRSTUVWXYZ") + "-" + rnd.digits(5),
        rating: String(rnd.int(1, 5)),
        quantity: String(rnd.int(1, 20)),
        price: money(rnd, 9.9, 4999),
        percent: String(rnd.int(1, 100)),
        title: lorem(rnd, 4, br.words).replace(".", ""),
        text: lorem(rnd, 12, br.words),
        paragraph: lorem(rnd, 18, br.words) + " " + lorem(rnd, 14, br.words),
        time: pad(rnd.int(8, 19), 2) + ":" + pad(rnd.int(0, 59), 2)
      }
    };

    persona.cpfRaw = T.onlyDigits(persona.cpf);
    persona.company.salaryFormatted = formatBRL(persona.company.salary);
    persona.misc.priceFormatted = formatBRL(persona.misc.price);
    persona.label = persona.fullName + " · " + persona.cpf;
    return persona;
  }

  WC.buildPersona = buildPersona;
  WC.personaHelpers = { isoDate: isoDate, brDate: brDate, usDate: usDate, formatBRL: formatBRL, lorem: lorem, makePassword: makePassword };

  if (typeof module !== "undefined" && module.exports) module.exports = { buildPersona: buildPersona };
})(typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : globalThis);
