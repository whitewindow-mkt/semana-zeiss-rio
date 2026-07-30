/* Meta Pixel — Semana ZEISS
 *
 * Carregado pelas 9 páginas do funil — o hub, mais quiz e cupom de cada
 * bandeira, em v1 e v2:
 *   /                     -> hub, escolha de bandeira
 *   /zeiss-quiz/          -> formulário, bandeira ZEISS          (v1)
 *   /zeiss-cupom/         -> conversão, bandeira ZEISS           (v1)
 *   /qualiotica-quiz/     -> formulário, bandeira QualiÓtica     (v1)
 *   /qualiotica-cupom/    -> conversão, bandeira QualiÓtica      (v1)
 *   /zeiss-quiz-v2/       -> formulário, bandeira ZEISS          (v2)
 *   /zeiss-cupom-v2/      -> conversão, bandeira ZEISS           (v2)
 *   /qualiotica-quiz-v2/  -> formulário, bandeira QualiÓtica     (v2)
 *   /qualiotica-cupom-v2/ -> conversão, bandeira QualiÓtica      (v2)
 *
 * EVENTOS
 *   PageView      todas as páginas
 *   ViewContent   páginas de quiz — entrada no funil
 *   Lead          páginas de cupom — pré-cadastro concluído
 *   Contact       clique no botão de WhatsApp, em qualquer página
 *   FindLocation  clique no link do mapa da loja, nas páginas de cupom
 *
 * Todo evento carrega o parâmetro `variante` (v1/v2), lido do endereço. É o
 * que permite comparar as duas versões no teste A/B pelo funil inteiro, e não
 * só pelo número de leads — que é pequeno demais para decidir sozinho.
 *
 * Purchase fica de fora de propósito: a venda acontece na loja física, dias
 * depois. Quando o cliente passar a entregar os dados de venda, ela entra
 * pela API de Conversões, não por aqui.
 *
 * DEDUPLICAÇÃO: o Lead é enviado duas vezes, uma pelo navegador (aqui) e uma
 * pelo servidor (Apps Script). Os dois carregam o MESMO event_id, gerado no
 * app.js do quiz e guardado no localStorage junto com os dados do lead. O
 * Meta usa esse id para contar a conversão uma vez só. Sem isso, toda
 * conversão contaria em dobro.
 */
(function () {
  'use strict';

  var PIXEL_ID = '2514969079016818'; // pixel "Semana Zeiss", portfólio QualiÓtica e ZEISS 2
  var LEAD_KEY = 'zeiss_lead_data';  // usado pelas duas bandeiras

  if (!PIXEL_ID) return;

  var path = window.location.pathname.toLowerCase();
  var isCupom = path.indexOf('cupom') !== -1;
  var isQuiz = path.indexOf('quiz') !== -1;
  var brand = path.indexOf('qualiotica') !== -1 ? 'QualiOtica' : 'ZEISS';

  // Versão da página, lida do próprio endereço: /zeiss-quiz-v2/ -> v2, e o
  // resto é v1. Vai em TODO evento daqui, porque é isso que permite abrir o
  // funil por versão no teste A/B (ViewContent -> Lead -> Contact) em vez de
  // só olhar o total somado das duas.
  var variante = /-v2(\/|$)/.test(path) ? 'v2' : 'v1';

  // Nas páginas de cupom não existe formulário para a correspondência
  // avançada ler, então entregamos e-mail, telefone e nome na mão, a partir
  // do que o quiz guardou. O Meta gera o hash antes de enviar.
  var lead = null;
  if (isCupom) {
    try {
      var raw = window.localStorage.getItem(LEAD_KEY);
      if (raw) lead = JSON.parse(raw);
    } catch (err) {
      lead = null; // localStorage bloqueado ou JSON inválido: segue sem match extra
    }
  }

  var matchData = {};
  if (lead) {
    if (lead.email) matchData.em = String(lead.email).trim().toLowerCase();
    if (lead.whatsapp) {
      var ddi = lead.paisCodigo ? String(lead.paisCodigo) : '+55';
      matchData.ph = (ddi + String(lead.whatsapp)).replace(/\D/g, '');
    }
    if (lead.nome) {
      var parts = String(lead.nome).trim().toLowerCase().split(/\s+/);
      matchData.fn = parts[0];
      if (parts.length > 1) matchData.ln = parts[parts.length - 1];
    }
  }

  // snippet base do Meta
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  if (Object.keys(matchData).length) {
    fbq('init', PIXEL_ID, matchData);
  } else {
    fbq('init', PIXEL_ID);
  }

  fbq('track', 'PageView', { variante: variante });

  // ── entrada no funil ────────────────────────────────────────────────
  if (isQuiz) {
    fbq('track', 'ViewContent', {
      content_name: 'Quiz Semana ZEISS',
      content_category: brand,
      variante: variante
    });
  }

  // ── conversão ───────────────────────────────────────────────────────
  if (isCupom) {
    var leadParams = {
      content_name: 'Pre-cadastro Semana ZEISS',
      content_category: brand,
      variante: variante
    };
    if (lead && lead.loja) leadParams.content_ids = [String(lead.loja)];

    if (lead && lead.eventId) {
      fbq('track', 'Lead', leadParams, { eventID: lead.eventId });
    } else {
      // sem eventId (visita direta na página de cupom, sem passar pelo
      // formulário) não há evento de servidor correspondente, então não
      // existe risco de contagem dupla
      fbq('track', 'Lead', leadParams);
    }
  }

  // ── cliques de intenção ─────────────────────────────────────────────
  // Delegado no document: os links de WhatsApp e mapa têm href definido pelo
  // app.js depois do carregamento, então não dá para amarrar listener direto
  // no elemento na hora que este script roda.
  document.addEventListener('click', function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('a') : null;
    if (!el) return;

    var href = (el.getAttribute('href') || '').toLowerCase();
    var id = (el.id || '').toLowerCase();

    var isWhats = id === 'whatsapp-link' ||
      (el.className && String(el.className).indexOf('whatsapp-float') !== -1) ||
      href.indexOf('wa.me') !== -1 ||
      href.indexOf('whatsapp.com') !== -1;

    var isMaps = id === 'maps-link' ||
      href.indexOf('maps.app.goo.gl') !== -1 ||
      href.indexOf('google.com/maps') !== -1;

    if (isWhats) {
      fbq('track', 'Contact', { content_category: brand, variante: variante });
      return;
    }

    if (isMaps) {
      fbq('track', 'FindLocation', {
        content_category: brand,
        variante: variante,
        content_name: (lead && lead.loja) ? String(lead.loja) : 'loja nao informada'
      });
    }
  }, true);
})();
