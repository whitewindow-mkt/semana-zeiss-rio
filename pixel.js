/* Meta Pixel — Semana ZEISS
 *
 * Carregado pelas 5 páginas do funil:
 *   /                  -> hub, escolha de bandeira
 *   /zeiss-quiz/       -> formulário, bandeira ZEISS
 *   /zeiss-cupom/      -> conversão, bandeira ZEISS
 *   /qualiotica-quiz/  -> formulário, bandeira QualiÓtica
 *   /qualiotica-cupom/ -> conversão, bandeira QualiÓtica
 *
 * PageView dispara em todas. Lead dispara só nas de cupom, que é onde o
 * visitante cai depois de enviar o formulário — por isso não precisa
 * escutar submit nem clique de botão.
 *
 * DEDUPLICAÇÃO: o mesmo Lead é enviado duas vezes, uma pelo navegador
 * (aqui) e uma pelo servidor (Apps Script, via API de Conversões). Os dois
 * carregam o MESMO event_id, gerado no app.js do quiz e guardado no
 * localStorage junto com os dados do lead. O Meta usa esse id para
 * entender que é o mesmo evento e contar uma vez só. Sem isso, toda
 * conversão contaria em dobro.
 */
(function () {
  'use strict';

  var PIXEL_ID = '2514969079016818'; // pixel "Semana Zeiss", portfólio QualiÓtica e ZEISS 2
  var LEAD_KEY = 'zeiss_lead_data';  // usado pelas duas bandeiras

  if (!PIXEL_ID) return;

  var path = window.location.pathname.toLowerCase();
  var isCupom = path.indexOf('cupom') !== -1;
  var brand = path.indexOf('qualiotica') !== -1 ? 'QualiOtica' : 'ZEISS';

  // Nas páginas de cupom não existe formulário para a correspondência
  // avançada ler, então entregamos e-mail e telefone na mão, a partir do
  // que o quiz guardou. O Meta gera o hash antes de enviar.
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

  fbq('track', 'PageView');

  if (isCupom) {
    var params = {
      content_name: 'Pre-cadastro Semana ZEISS',
      content_category: brand
    };
    if (lead && lead.loja) params.content_ids = [String(lead.loja)];

    if (lead && lead.eventId) {
      fbq('track', 'Lead', params, { eventID: lead.eventId });
    } else {
      // sem eventId (visita direta na página de cupom, sem passar pelo
      // formulário) não há evento de servidor correspondente, então não
      // existe risco de contagem dupla
      fbq('track', 'Lead', params);
    }
  }
})();
