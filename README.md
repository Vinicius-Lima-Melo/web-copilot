<p align="center">
  <img src="images/logo.png" width="220">
</p>

<h1 align="center">Web Copilot</h1>

<p align="center">
  Extensão de navegador que preenche formulários com dados de teste brasileiros
  <b>válidos de verdade</b> — CPF, CNPJ, CNH, PIS, CNS, cartão, PIX e boleto com
  dígito verificador correto.<br>
  100% offline, sem API, sem cadastro, sem custo.
</p>

---

## O que ela faz

Você abre um formulário de cadastro, aperta `Ctrl+Shift+Y`, e ele é preenchido
com uma **persona coerente**: o e-mail deriva do nome, o DDD do telefone bate com
a cidade, o CEP começa na faixa postal daquela cidade, o nome da mãe compartilha
o sobrenome e "confirmar senha" bate com "senha".

Não é dado aleatório — é um cadastro que **passa na validação**.

## Instalação

1. Baixe ou clone este repositório.
2. Abra `chrome://extensions` e ligue o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e escolha a pasta do projeto.

Funciona em Chrome, Edge, Brave, Opera e qualquer navegador baseado em Chromium
com suporte a Manifest V3.

## Como usar

| Ação | Como |
|---|---|
| Preencher a página | `Ctrl+Shift+Y`, o botão do popup, ou o painel flutuante |
| Gerar outra persona e preencher | `Alt+Shift+Y` |
| Desfazer o preenchimento | `Alt+Shift+Z` |
| Preencher **um** campo específico | Botão direito no campo › *Preencher este campo com…* |
| Ensinar um campo que ele errou | Botão direito no campo › *Ensinar: este campo é…* |
| Copiar um dado da persona | Aba **Persona** no popup, clique na linha |

## Recursos

### Documentos com dígito verificador válido

CPF · CNPJ (numérico **e alfanumérico**, vigente desde julho/2026) · RG · CNH ·
PIS/PASEP · CNS (cartão SUS) · título de eleitor · inscrição estadual ·
RENAVAM · chassi (VIN) · cartão de crédito por bandeira (Luhn) · IMEI ·
EAN-13 · ISBN · linha digitável de boleto (Febraban, 47 posições) ·
número de processo judicial (CNJ, mod 97).

Todos são gerados e **conferidos pelo validador correspondente** na bateria de
testes — 500 amostras por documento, mais valores reais conhecidos como âncora.

### Mais de 120 tipos de campo

Identidade, contato, documentos, endereço, empresa, acesso, pagamento, veículo,
datas, números, texto e códigos. O menu de contexto lista todos, agrupados.

### Três modos de dados

| Modo | Para que serve |
|---|---|
| **Válido** | O cadastro passa. É o padrão. |
| **Inválido** | CPF com DV quebrado, e-mail malformado, data de nascimento no futuro, senha curta demais. Serve para conferir se a **sua** validação realmente reprova. |
| **Caos** | XSS, SQL, template injection, unicode, RTL, emoji, strings de 1 KB, espaços e tabs. Serve para conferir sanitização, escaping e limites de tamanho. |

### Persona reproduzível

Defina uma **semente** na aba Persona e a mesma semente gera sempre a mesma
pessoa — mesmo CPF, mesmo endereço, mesmo cartão. É o que transforma "deu erro
com um cadastro estranho" em um caso de teste que você reexecuta. Dá para
**travar** a persona e ver as **últimas 20** no histórico, com um clique para
voltar a usar qualquer uma.

### Detecção que entende formulário de verdade

- **Pontuação ponderada** em vez de "primeira regra que casar": cada sinal
  (autocomplete, `name`, `id`, `<label>`, `aria-label`, placeholder, `data-*`,
  texto vizinho, `type`, `maxlength`) tem peso, cada regra tem especificidade.
  É assim que "CPF/CNPJ" ganha de "CNPJ" e "Número do cartão" não vira número
  de casa.
- **`autocomplete` padrão** (WHATWG) tem a palavra final quando o site declara.
- **Rótulo solto** de React/Vue/Material, sem `<label for>`.
- **Shadow DOM** e **iframes** (todos os frames são atendidos).
- **Veto** em busca, filtro, cupom, captcha e honeypot — a extensão não suja
  campo que não é de cadastro, e não se entrega como bot preenchendo armadilha.
- **Português, inglês e espanhol** no mesmo conjunto de regras.
- Campos que ele não reconheceu aparecem listados no popup, prontos para você
  ensinar. O que você ensina fica salvo **por domínio**.

### Preenchimento que funciona em framework moderno

- Escreve pelo **setter nativo** do protótipo, o que faz React, Vue e Angular
  registrarem a mudança de verdade (escrever direto no `.value` não dispara
  `onChange`).
- **Digitação tecla a tecla** opcional, para campos com máscara que só reagem a
  eventos de teclado (jQuery Mask, IMask, v-mask).
- Respeita `maxlength` — se o valor formatado não cabe, manda sem máscara em vez
  de cortar o documento no meio.
- Entende `<select>` (casa por texto ou valor, e escolhe uma opção qualquer
  válida nos selects sem semântica), grupos de `<radio>`, checkboxes,
  `contenteditable` e todos os tipos nativos do HTML5.
- Ignora `disabled`, `readonly` e campos não renderizados.
- **Desfazer** restaura os valores anteriores.

### Painel na página

Um painel flutuante em Shadow DOM (imune ao CSS do site) mostra quem é a persona
atual, quantos campos foram preenchidos e quantos ficaram de fora, com botões
para repreencher, trocar de persona, desfazer, copiar o JSON e limpar as marcas.

### Sem recarregar a página

Trocar qualquer configuração passa a valer na hora. Se a aba já estava aberta
antes da instalação, o service worker injeta o script sob demanda.

## Página de testes

`WebCopilot_Tester.html` é um laboratório com 14 blocos: pessoa física, documentos,
endereço, pessoa jurídica, pagamento, veículo, `autocomplete` padrão, rótulos
soltos de framework, campos com máscara, selects/rádios/textarea/contenteditable,
tipos nativos do HTML5, campos que **não** devem ser preenchidos, atributo legado
`web-copilot` e um web component com shadow DOM.

Abrindo com `?selftest=1` a própria página carrega os módulos e roda a
verificação automática, sem precisar da extensão instalada.

## Testes

```bash
./tests/run.sh          # bateria completa
node --test "tests/*.test.js"   # só a lógica pura
```

Três frentes: 95 testes de lógica no Node (documentos, detecção, modos,
consistência entre regras/geradores/rótulos/menu), o preenchimento real de 103
campos no Chrome headless com 29 verificações, e a validação do manifesto pelo
próprio Chrome.

## Estrutura

```
manifest.json           Manifest V3
background.js           Service worker: persona compartilhada, menu de contexto,
                        atalhos, injeção sob demanda
webcopilot.js           Content script: orquestra detecção + preenchimento
index.html              Popup (3 abas)
scripts/
  wc-core.js            PRNG com semente + utilidades de texto
  wc-datasets.js        Bases BR/US (cidades com DDD e CEP coerentes, bancos…)
  wc-docs.js            Documentos brasileiros: geradores + validadores
  wc-persona.js         Monta a persona coerente
  wc-values.js          Catálogo de 125 tipos de campo e os 3 modos
  wc-detect.js          Detecção por pontuação
  wc-fill.js            Camada de DOM: coleta, sinais, escrita, desfazer
  wc-hud.js             Painel flutuante (Shadow DOM)
  script.js             Lógica do popup
tests/                  Bateria de testes
```

Os módulos de lógica não tocam em `document` nem em `chrome`, por isso rodam
igual no navegador, no service worker e no Node.

## Privacidade

Nenhum dado sai da sua máquina. Não há requisição de rede, telemetria nem
dependência externa — os e-mails gerados usam domínios `.invalid` e `.test`,
reservados por RFC, que nunca resolvem: nenhum e-mail de verificação escapa para
a caixa de uma pessoa real.

> Dados fictícios, para testar seus próprios formulários. Nunca use em cadastro real.
