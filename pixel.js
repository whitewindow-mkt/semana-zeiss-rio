/* Meta Pixel — Semana ZEISS
 *
 * Carregado pelas 4 páginas do funil:
 *   /zeiss-quiz/       -> topo do funil, bandeira ZEISS
 *   /zeiss-cupom/      -> conversão, bandeira ZEISS
 *   /qualiotica-quiz/  -> topo do funil, bandeira QualiÓtica
 *   /qualiotica-cupom/ -> conversão, bandeira QualiÓtica
 *
 * PageView dispara em todas. Lead dispara só nas de cupom, que é onde o
 * visitante cai depois de enviar o formulário — por isso não precisa
 * escutar submit nem clique de botão.
 *
 * Enquanto PIXEL_ID estiver vazio o arquivo não faz nada. Preencher o ID
 * é o único passo que falta; ao preencher, subir a versão do <script src>
 * nas 4 páginas para o CDN do GitHub Pages servir o arquivo novo.
 */
(function () {
  'use strict';

  var PIXEL_ID = '2514969079016818'; // pixel "Semana Zeiss", portfólio QualiÓtica e ZEISS 2

  if (!PIXEL_ID) return;

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

  fbq('init', PIXEL_ID);
  fbq('track', 'PageView');

  var path = window.location.pathname.toLowerCase();
  var brand = path.indexOf('qualiotica') !== -1 ? 'QualiOtica' : 'ZEISS';

  if (path.indexOf('cupom') !== -1) {
    // chegou na página de cupom = concluiu o pré-cadastro
    fbq('track', 'Lead', {
      content_name: 'Pre-cadastro Semana ZEISS',
      content_category: brand
    });
  }
})();
