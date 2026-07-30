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
 * Todo evento carrega dois parâmetros:
 *   variante  v1/v2, lido do endereço — compara as duas versões no teste A/B
 *             pelo funil inteiro, não só pelo número de leads.
 *   canal     de onde a pessoa veio (utm_source, ou deduzido do fbclid e do
 *             referer) — separa anúncio, e-mail do cliente e WhatsApp. Fica
 *             guardado na sessão porque a página de cupom não recebe a query
 *             string, e é lá que acontece o Lead.
 *
 * NÃO DISPARA FORA DE semanazeissrio.com.br. Teste em servidor local mandava
 * evento de verdade pro pixel do cliente — 184 eventos de localhost em 30/07,
 * impossíveis de apagar depois.
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

  // Só mede no domínio de produção. Sem isso, todo teste em servidor local
  // manda evento de verdade pro pixel do cliente: em 30/07 entraram 184
  // eventos de http://localhost/ e nao ha como apagar depois. Teste local
  // agora nao dispara nada, e o console diz por que.
  if (window.location.hostname !== 'semanazeissrio.com.br') {
    if (window.console && console.info) {
      console.info('[pixel] desligado fora de semanazeissrio.com.br (host atual: ' +
                   window.location.hostname + ') — teste local nao suja o dado do cliente');
    }
    return;
  }

  var path = window.location.pathname.toLowerCase();
  var isCupom = path.indexOf('cupom') !== -1;
  var isQuiz = path.indexOf('quiz') !== -1;
  var brand = path.indexOf('qualiotica') !== -1 ? 'QualiOtica' : 'ZEISS';

  // Versão da página, lida do próprio endereço: /zeiss-quiz-v2/ -> v2, e o
  // resto é v1. Vai em TODO evento daqui, porque é isso que permite abrir o
  // funil por versão no teste A/B (ViewContent -> Lead -> Contact) em vez de
  // só olhar o total somado das duas.
  var variante = /-v2(\/|$)/.test(path) ? 'v2' : 'v1';

  // ── de onde a pessoa veio ────────────────────────────────────────────
  // Lê utm_source do endereço e guarda na sessão. Precisa guardar porque a
  // página de cupom não recebe a query string — sem isso o evento Lead, que
  // é o que importa, chegaria sem canal. Ordem: o que está na URL manda; se
  // não tiver, usa o que a sessão guardou; se não tiver nada, tenta adivinhar
  // pelo referer e, no fim, cai em 'direto'.
  var canal = (function () {
    var CHAVE = 'sz_canal';
    var achado = (/[?&]utm_source=([^&#]+)/i.exec(window.location.search) || [])[1];
    if (achado) {
      achado = decodeURIComponent(achado).slice(0, 40);
      try { window.sessionStorage.setItem(CHAVE, achado); } catch (e) {}
      return achado;
    }
    try {
      var guardado = window.sessionStorage.getItem(CHAVE);
      if (guardado) return guardado;
    } catch (e) {}
    // fbclid é assinatura de clique em anúncio do Meta, mesmo sem utm
    if (/[?&]fbclid=/i.test(window.location.search)) return 'meta-ads';
    var ref = (document.referrer || '').toLowerCase();
    if (!ref) return 'direto';
    if (ref.indexOf('facebook') !== -1 || ref.indexOf('instagram') !== -1) return 'meta-organico';
    if (ref.indexOf('google') !== -1) return 'google';
    if (ref.indexOf('semanazeissrio.com.br') !== -1) return 'interno';
    return 'outro';
  })();

  // Guarda o canal decidido e deixa disponivel pro app.js do quiz, que manda
  // junto com o lead. Uma regra so, num lugar so: se o app.js repetisse a
  // logica, as duas iam divergir no primeiro ajuste.
  try { window.sessionStorage.setItem('sz_canal', canal); } catch (e) {}
  window.SZ_CANAL = canal;

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

  fbq('track', 'PageView', { variante: variante, canal: canal });

  // ── entrada no funil ────────────────────────────────────────────────
  if (isQuiz) {
    fbq('track', 'ViewContent', {
      content_name: 'Quiz Semana ZEISS',
      content_category: brand,
      variante: variante,
      canal: canal
    });
  }

  // ── conversão ───────────────────────────────────────────────────────
  if (isCupom) {
    var leadParams = {
      content_name: 'Pre-cadastro Semana ZEISS',
      content_category: brand,
      variante: variante,
      canal: canal
    };
    if (lead && lead.loja) leadParams.content_ids = [String(lead.loja)];

    // So conta Lead quando existe eventId, ou seja, quando a pessoa passou
    // pelo formulario. A pagina de cupom e URL publica: link compartilhado,
    // busca ou recarga abriam ela sem eventId, e sem eventId o Meta nao tem
    // como saber que dois disparos sao a mesma pessoa — cada abertura virava
    // um Lead novo. Medido em 30/07: 45 Leads pelo navegador contra 37 pelo
    // servidor, ~18% de fantasma.
    //
    // Quem converteu de verdade e esta com o localStorage bloqueado nao se
    // perde: o evento de servidor (Worker) dispara igual, pela API de
    // Conversoes. Nenhuma conversao real deixa de ser contada aqui.
    var FIRED_KEY = 'sz_lead_enviado';
    if (lead && lead.eventId) {
      var jaEnviado = false;
      try { jaEnviado = window.localStorage.getItem(FIRED_KEY) === lead.eventId; } catch (e) {}
      if (!jaEnviado) {
        fbq('track', 'Lead', leadParams, { eventID: lead.eventId });
        // Marca antes da recarga poder acontecer. Se o localStorage estiver
        // bloqueado, cai no comportamento antigo e a deduplicacao do Meta
        // pelo eventID segura — nunca o contrario.
        try { window.localStorage.setItem(FIRED_KEY, lead.eventId); } catch (e) {}
      }
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
      fbq('track', 'Contact', { content_category: brand, variante: variante, canal: canal });
      return;
    }

    if (isMaps) {
      fbq('track', 'FindLocation', {
        content_category: brand,
        variante: variante,
        canal: canal,
        content_name: (lead && lead.loja) ? String(lead.loja) : 'loja nao informada'
      });
    }
  }, true);
})();
