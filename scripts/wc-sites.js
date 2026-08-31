/**
 * Web Copilot — escopo de sites do autocompletar.
 *
 * Existe por causa de um bug concreto: com o autocompletar ligado, a extensão
 * escrevia sozinha no compositor de mensagem do WhatsApp Web. Não foi regra de
 * detecção mal ajustada — o compositor do WhatsApp tem `aria-label="Digite uma
 * mensagem"` e o classificador dá a ele exatamente a mesma pontuação (54, tipo
 * `comment`) que dá a um campo "Observações" de formulário de cadastro. Pelos
 * sinais do DOM os dois são indistinguíveis, então nenhuma regra nova resolve.
 *
 * O que resolve é separar as duas coisas que estavam juntas:
 *
 *   - Preenchimento MANUAL (atalho, botão do popup, menu de contexto):
 *     continua funcionando em qualquer site. O usuário escolheu o momento.
 *   - Preenchimento AUTOMÁTICO (MutationObserver): só em sites que o usuário
 *     liberou explicitamente. Nunca por padrão, em lugar nenhum.
 *
 * Antes, `WC_autocomplete` era um booleano global: ligar para testar um
 * formulário ligava para o navegador inteiro, inclusive abas de conversa
 * abertas em outra janela.
 *
 * Lógica pura: sem `document`, sem `chrome`. Roda no content script, no
 * service worker e no Node.
 */
(function (root) {
  "use strict";

  var WC = (root.WC = root.WC || {});

  /**
   * Sites onde o automático nunca é liberado, nem se o usuário pedir.
   *
   * Não é uma lista de "sites ruins" — é a lista de aplicativos cuja caixa de
   * texto principal parece campo de formulário para o classificador e cujo
   * envio acidental tem consequência real (mandar mensagem para uma pessoa,
   * publicar um post, enviar um e-mail). Em cadastro de teste, o pior caso é
   * um cadastro errado; aqui o pior caso sai da tela.
   *
   * O manual continua permitido nesses sites: se você apertar o atalho dentro
   * do WhatsApp, foi uma escolha sua, e o `Alt+Shift+Z` desfaz.
   */
  var BLOCKED = [
    "web.whatsapp.com", "whatsapp.com",
    "mail.google.com", "outlook.live.com", "outlook.office.com", "outlook.office365.com",
    "app.slack.com", "slack.com",
    "discord.com", "teams.microsoft.com", "chat.google.com",
    "web.telegram.org", "telegram.org", "messenger.com",
    "x.com", "twitter.com", "instagram.com", "facebook.com",
    "linkedin.com", "bsky.app", "reddit.com"
  ];

  /** Normaliza para comparação: minúsculas, sem `www.` e sem porta. */
  function normalizeHost(host) {
    if (!host) return "";
    return String(host).toLowerCase().trim().replace(/:\d+$/, "").replace(/^www\./, "");
  }

  /**
   * Casa host com padrão. `exemplo.com` cobre os subdomínios de `exemplo.com`
   * — sem isso, liberar um site exigiria repetir a entrada para cada
   * subdomínio (`app.`, `checkout.`, `homolog.`), que é justamente o caso de
   * quem testa um cadastro em ambientes diferentes.
   */
  function hostMatches(host, pattern) {
    host = normalizeHost(host);
    pattern = normalizeHost(pattern);
    if (!host || !pattern) return false;
    if (host === pattern) return true;
    return host.slice(-(pattern.length + 1)) === "." + pattern;
  }

  function matchesAny(host, list) {
    for (var i = 0; i < (list || []).length; i++) {
      if (hostMatches(host, list[i])) return true;
    }
    return false;
  }

  /** Site de mensagem/rede social: automático proibido, manual liberado. */
  function isBlocked(host) {
    return matchesAny(host, BLOCKED);
  }

  /**
   * A pergunta que o content script faz antes de ligar o MutationObserver.
   * Default fechado: sem entrada na lista, não observa nada.
   */
  function canAutofill(host, allowList) {
    if (!host) return false;
    if (isBlocked(host)) return false;
    return matchesAny(host, allowList);
  }

  /** Sugestão de entrada para a lista: o domínio registrável, não o host cheio. */
  function suggestPattern(host) {
    host = normalizeHost(host);
    if (!host || host === "localhost") return host;
    // IP literal entra como está — não tem domínio registrável.
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return host;

    var parts = host.split(".");
    if (parts.length <= 2) return host;

    // ccTLD de segundo nível comuns no Brasil (com.br, gov.br, …): aí o
    // registrável tem 3 rótulos, não 2.
    var doisNiveis = /^(com|net|org|gov|edu|mil|art|blog|eco|ind|inf|rec|srv|tv)\.[a-z]{2}$/;
    var doisUltimos = parts.slice(-2).join(".");
    if (doisNiveis.test(doisUltimos) && parts.length >= 3) return parts.slice(-3).join(".");

    return doisUltimos;
  }

  function addSite(list, host) {
    var pattern = suggestPattern(host);
    if (!pattern) return (list || []).slice();
    var out = (list || []).slice();
    if (!matchesAny(host, out)) out.push(pattern);
    return out;
  }

  /** Remove toda entrada que cobre esse host (não só a igual). */
  function removeSite(list, host) {
    return (list || []).filter(function (pattern) {
      return !hostMatches(host, pattern);
    });
  }

  WC.sites = {
    BLOCKED: BLOCKED,
    normalizeHost: normalizeHost,
    hostMatches: hostMatches,
    isBlocked: isBlocked,
    canAutofill: canAutofill,
    suggestPattern: suggestPattern,
    addSite: addSite,
    removeSite: removeSite
  };

  if (typeof module !== "undefined" && module.exports) module.exports = WC;
})(typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : globalThis);
