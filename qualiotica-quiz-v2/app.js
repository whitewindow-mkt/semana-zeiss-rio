/* V2 da captura ZEISS — teste contra /zeiss-quiz/
 *
 * O que mudou em relação à v1:
 *   - cupom borrado e desborrar progressivo removidos (não moviam número)
 *   - abertura em cortina removida: a pessoa vê a oferta no primeiro frame
 *   - o formulário desceu para o fim do card, então nada recebe foco no
 *     carregamento (senão o teclado do celular pularia o banner e a oferta)
 *   - envia para /qualiotica-cupom-v2/, para separar o lead das duas versões
 *     no Gerenciador pela URL
 */
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // Webhook de leads (Google Apps Script) — mesmo destino da v1
    const WEBHOOK_URL = 'https://semana-zeiss-capi.whitewindow-mkt360.workers.dev';
    // Perna 2 do envio. O Worker acima e a fonte de verdade (D1 + Meta);
    // este alimenta a planilha e manda o e-mail pelo MailApp, com remetente
    // do Gmail. Os dois recebem o MESMO payload.
    const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwA-h4CKdE8bIzkoh5WrxVcuM77FLFmJhQag2yMrdypD2ReFxEQl0K6DtomjyM7fFH5/exec';

    // Para onde a pessoa vai depois de enviar. A v1 manda para /zeiss-cupom/;
    // esta versao tem a sua propria pagina de cupom para que o evento Lead de
    // cada versao apareca separado por URL no Gerenciador de Eventos.
    const CUPOM_URL = '/qualiotica-cupom-v2/';

    const VARIANTE = 'v2';

    // Floating WhatsApp button — visible on every step, updates once a store is chosen
    const whatsappFloat = document.getElementById('whatsapp-link');
    const floatStoreWhatsappMap = {
        // QUALIÓTICA NITERÓI — WhatsApp central da bandeira (agente de IA)
        'QualiÓtica Tiffany (Icaraí)': '5521969426672',
        'QualiÓtica Crystal Platinum (Icaraí)': '5521969426672',
        'QualiÓtica Mariz e Barros (Jardim Icaraí)': '5521969426672',
        'QualiÓtica Av. Sete (Jardim Icaraí)': '5521969426672',
        'QualiÓtica Itaipu (Shopping Itaipu Multicenter)': '5521969426672',
        'QualiÓtica Piratininga': '5521969426672',
        'QualiÓtica Centro (Conceição)': '5521969426672',
        // QUALIÓTICA SÃO GONÇALO — WhatsApp central da bandeira (agente de IA)
        'QualiÓtica Nilo Peçanha': '5521969426672',
        'QualiÓtica Salvatori': '5521969426672',
        'QualiÓtica Coronel Rodrigues': '5521969426672'
    };
    const defaultFloatWhatsapp = floatStoreWhatsappMap['QualiÓtica Tiffany (Icaraí)'];
    function updateWhatsappFloat() {
        if (!whatsappFloat) return;
        const store = document.getElementById('loja') ? document.getElementById('loja').value : '';
        // Central da bandeira, nao o numero da loja (decisao de 30/07/2026).
        // O mapa por loja fica no codigo caso a decisao volte atras.
        const number = '5521969426672';
        // Mensagem única pra todo mundo. A pessoa pode clicar aqui no primeiro
        // segundo, antes de escolher loja: texto que falava de "meu cadastro"
        // e citava a unidade chegava errado ou pela metade.
        const message = 'Olá! Vi a Semana ZEISS e queria tirar uma dúvida.';
        whatsappFloat.href = `https://api.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(message)}`;
    }
    updateWhatsappFloat();

    // DOM Elements
    const progressFill = document.getElementById('progress-fill');
    const stepCounter = document.getElementById('step-counter');
    const formZone = document.getElementById('form-zone');

    // Form inputs (4 campos)
    const nomeInput = document.getElementById('nome');
    const whatsappInput = document.getElementById('whatsapp');
    const emailInput = document.getElementById('email');
    const lojaSelect = document.getElementById('loja');
    const countrySelect = document.getElementById('country-select');
    const btnSubmitForm = document.getElementById('btn-submit-form');

    // Quiz step elements
    const steps = Array.from(document.querySelectorAll('.quiz-step'));
    const totalSteps = steps.length;
    let currentStep = 1;

    // -------------------------------------------------------------
    // FORM VALIDATION
    // -------------------------------------------------------------

    function checkFieldsValidity() {
        // Nome: exige nome + espaço + ao menos 1 letra do sobrenome (ex: "Nathan m")
        const isBrazil = !countrySelect || countrySelect.value === '55';
        const phoneDigits = whatsappInput.value.replace(/\D/g, '');

        const results = {
            nome: /\S+\s+\S+/.test(nomeInput.value),
            // Brasil: DDD + numero (10-11 digitos). Outros paises: so exige pelo menos 8 digitos, formato varia.
            whatsapp: isBrazil ? (phoneDigits.length >= 10 && phoneDigits.length <= 11) : (phoneDigits.length >= 8),
            // Exige apenas arroba + algo + ponto + algo (sem validar TLD especifico, pra nao travar)
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim()),
            loja: lojaSelect.value !== ''
        };

        let completedCount = 0;
        if (results.nome) completedCount++;
        if (results.whatsapp) completedCount++;
        if (results.email) completedCount++;
        if (results.loja) completedCount++;

        return { validity: results, completedCount: completedCount };
    }

    // Ordem das perguntas na tela. A loja vem primeiro desde 30/07/2026:
    // 437 pessoas abriam o quiz e so 39 respondiam a 1a pergunta, que pedia
    // o nome. Escolher a loja e clique, nao digitacao de dado pessoal.
    const fieldByStep = { 1: 'loja', 2: 'nome', 3: 'whatsapp', 4: 'email' };
    const stepByField = {};
    Object.keys(fieldByStep).forEach((n) => { stepByField[fieldByStep[n]] = Number(n); });
    // Usar sempre esta funcao, nunca o numero do passo cravado: assim
    // reordenar as perguntas nao deixa validacao apontando pro campo errado.
    // Chama tambem o updateSubmitState: o botao de envio agora exige os 4
    // campos e mora no ultimo passo, que nao tem [data-next] — sem isto o
    // updateNextButtonForStep sai fora e o envio nunca libera.
    function atualizarBotaoDoCampo(campo) { updateNextButtonForStep(stepByField[campo]); updateSubmitState(); }

    // Funil interno do quiz. Guarda quais etapas ja foram contadas para nao
    // inflar o numero quando a pessoa volta e avanca de novo.
    const passosDisparados = new Set();
    const BRAND_LABEL = 'QualiOtica';

    function updateSubmitState() {
        const { validity, completedCount } = checkFieldsValidity();
        if (btnSubmitForm) {
            // Exige os 4 campos. Antes bastava a loja, porque ela era a ultima
            // pergunta — com a loja em primeiro isso liberaria o envio cedo demais.
            btnSubmitForm.disabled = completedCount < 4;
        }
    }

    // -------------------------------------------------------------
    // QUIZ STEP NAVIGATION
    // -------------------------------------------------------------

    function goToStep(stepNumber, direction, opts) {
        const options = opts || {};

        // Fecha o teclado do celular e ajuda a desfazer o zoom do campo
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }

        // Truque de reset do viewport + rolagem depois que o teclado desce.
        // Rola para o formulário, não para o topo: nesta versão o topo é o
        // banner, e a pergunta ficaria fora da tela.
        if (!options.initial) {
            setTimeout(() => {
                const viewport = document.querySelector('meta[name="viewport"]');
                if (viewport) {
                    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
                    setTimeout(() => {
                        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
                    }, 100);
                }
                if (formZone) formZone.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 350);
        }

        const dir = direction || (stepNumber >= currentStep ? 'forward' : 'back');
        currentStep = stepNumber;

        // Marca a etapa alcancada, uma vez so e so na ida. A etapa 1 nao
        // entra: quem abriu a pagina ja conta como ViewContent no pixel.
        // Com isso da para ler onde a pessoa desiste dentro do quiz.
        if (dir === 'forward' && stepNumber > 1 && !passosDisparados.has(stepNumber)) {
            passosDisparados.add(stepNumber);
            if (window.fbq) {
                window.fbq('trackCustom', 'QuizCampo_' + (fieldByStep[stepNumber] || stepNumber), {
                    campo: fieldByStep[stepNumber] || '',
                    content_category: BRAND_LABEL,
                    variante: VARIANTE
                });
            }
        }

        steps.forEach((stepEl) => {
            const isTarget = Number(stepEl.dataset.step) === stepNumber;
            stepEl.classList.remove('active', 'dir-forward', 'dir-back');
            if (isTarget) {
                // Force reflow so the animation re-triggers even if this step was shown before
                void stepEl.offsetWidth;
                stepEl.classList.add('active', dir === 'back' ? 'dir-back' : 'dir-forward');
            }
        });

        if (stepCounter) stepCounter.textContent = `Pergunta ${stepNumber} de ${totalSteps}`;
        if (progressFill) progressFill.style.width = `${(stepNumber / totalSteps) * 100}%`;

        // Foco automatico so quando a pessoa avanca de etapa. No carregamento
        // nao: o teclado subiria e levaria a tela direto para o formulario,
        // pulando o banner e a oferta.
        if (!options.initial) {
            const activeField = document.getElementById(fieldByStep[stepNumber]);
            if (activeField) setTimeout(() => activeField.focus(), 400);
        }

        updateSubmitState();
    }

    function updateNextButtonForStep(stepNumber) {
        const stepEl = steps.find((el) => Number(el.dataset.step) === stepNumber);
        if (!stepEl) return;
        const nextBtn = stepEl.querySelector('[data-next]');
        if (!nextBtn) return;

        const { validity, completedCount } = checkFieldsValidity();
        nextBtn.disabled = !validity[fieldByStep[stepNumber]];
    }

    document.querySelectorAll('[data-next]').forEach((btn) => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            goToStep(currentStep + 1);
        });
    });

    document.querySelectorAll('[data-back]').forEach((btn) => {
        btn.addEventListener('click', () => {
            goToStep(Math.max(1, currentStep - 1));
        });
    });

    // Advance to next step by pressing Enter inside a text input
    [nomeInput, whatsappInput, emailInput].forEach((input) => {
        input.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const stepEl = input.closest('.quiz-step');
            const nextBtn = stepEl.querySelector('[data-next]');
            if (nextBtn && !nextBtn.disabled) goToStep(currentStep + 1);
        });
    });

    // -------------------------------------------------------------
    // EVENT LISTENERS & INPUT HANDLING
    // -------------------------------------------------------------

    nomeInput.addEventListener('input', () => { atualizarBotaoDoCampo('nome'); });
    emailInput.addEventListener('input', () => { atualizarBotaoDoCampo('email'); });
    lojaSelect.addEventListener('change', () => { atualizarBotaoDoCampo('loja'); updateSubmitState(); updateWhatsappFloat(); });

    // WhatsApp Input Formatting Mask & trigger validation (mascara BR so quando o pais for Brasil)
    whatsappInput.addEventListener('input', (e) => {
        const isBrazil = !countrySelect || countrySelect.value === '55';
        let value = e.target.value.replace(/\D/g, ''); // Remove non-numeric

        if (isBrazil) {
            if (value.length > 11) value = value.substring(0, 11);
            if (value.length > 6) {
                e.target.value = `(${value.substring(0, 2)}) ${value.substring(2, 7)}-${value.substring(7)}`;
            } else if (value.length > 2) {
                e.target.value = `(${value.substring(0, 2)}) ${value.substring(2)}`;
            } else if (value.length > 0) {
                e.target.value = `(${value}`;
            } else {
                e.target.value = '';
            }
        }
        // Outros paises: digitação livre, sem mascara (formato varia por pais)

        atualizarBotaoDoCampo('whatsapp');
    });

    // Trocar de pais: liga/desliga a mascara BR e ajusta o placeholder
    if (countrySelect) {
        countrySelect.addEventListener('change', () => {
            const isBrazil = countrySelect.value === '55';
            whatsappInput.value = whatsappInput.value.replace(/\D/g, '');
            whatsappInput.placeholder = isBrazil ? '(00) 00000-0000' : 'Número com DDD/código local';
            if (isBrazil) whatsappInput.dispatchEvent(new Event('input', { bubbles: true }));
            atualizarBotaoDoCampo('whatsapp');
        });
    }

    // -------------------------------------------------------------
    // FORM SUBMIT & LEADS RETENTION
    // -------------------------------------------------------------
    const unifiedForm = document.getElementById('unified-form');

    unifiedForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const { completedCount } = checkFieldsValidity();
        if (completedCount < 4) return; // Halt if form is incomplete

        const nome = nomeInput.value.trim();
        const whatsapp = whatsappInput.value.trim();
        const email = emailInput.value.trim();
        const loja = lojaSelect.value;
        const paisCodigo = countrySelect ? (countrySelect.value === 'other' ? '' : `+${countrySelect.value}`) : '+55';

        // Le um cookie pelo nome. Usado para pegar os identificadores que o
        // pixel do Meta grava no navegador.
        const readCookie = (name) => {
            const hit = document.cookie.split('; ').find((c) => c.indexOf(name + '=') === 0);
            return hit ? decodeURIComponent(hit.split('=').slice(1).join('=')) : '';
        };

        // Construct lead payload
        const leadData = {
            // Id unico deste envio. Vai junto para o localStorage e para o
            // webhook, entao o navegador e o servidor mandam o Lead para o
            // Meta com o mesmo id e a conversao nao conta duas vezes.
            eventId: 'lead-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10),
            // Sinais que o servidor nao tem acesso e sao os que mais elevam a
            // correspondencia na API de Conversoes. fbc e o que amarra o
            // evento ao clique no anuncio; sem ele a atribuicao do servidor
            // nao sabe de qual anuncio a pessoa veio.
            userAgent: navigator.userAgent || '',
            fbp: readCookie('_fbp'),
            fbc: readCookie('_fbc'),
            nome: nome,
            whatsapp: whatsapp,
            paisCodigo: paisCodigo,
            email: email,
            receita: 'exame', // Leads default to scheduling examination validation on thanks page
            loja: loja,
            timestamp: new Date().toISOString(),
            origem: 'Semana Zeiss - QualiÓtica',
            // Marca a versao da pagina na planilha, para conferir o teste
            // pela fonte do lead e nao so pelo numero do Meta.
            variante: VARIANTE,
            // De onde a pessoa veio. Quem decide e o pixel.js, que roda antes
            // no <head>; aqui so lemos o que ele guardou, pra nao existir uma
            // segunda regra de canal capaz de divergir da primeira.
            canal: (function () {
                if (window.SZ_CANAL) return window.SZ_CANAL;
                try { return window.sessionStorage.getItem('sz_canal') || 'direto'; }
                catch (e) { return 'direto'; }
            })()
        };

        // Save locally to display on the coupon page
        localStorage.setItem('zeiss_lead_data', JSON.stringify(leadData));

        if (WEBHOOK_URL) {
            // Show loading state to prevent double submits and show background progress
            if (btnSubmitForm) {
                btnSubmitForm.disabled = true;
                btnSubmitForm.innerHTML = `Resgatando cupom... <i data-lucide="loader" class="spin" style="width: 15px; height: 15px; vertical-align: middle; margin-left: 5px;"></i>`;
                if (window.lucide) window.lucide.createIcons();
            }


            // Perna 2 — planilha + e-mail (MailApp). Dispara e esquece: vai com
            // no-cors porque o /exec do Apps Script nao devolve cabecalho CORS.
            // Se falhar, o lead JA esta salvo pela chamada do Worker abaixo —
            // foi a falta desse segundo caminho que abriu o buraco de 30/07.
            if (SHEETS_URL) {
                fetch(SHEETS_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(leadData),
                    keepalive: true
                }).catch((e) => console.error('Apps Script falhou (lead segue salvo no Worker):', e));
            }
            fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(leadData),
                // keepalive: se a pessoa sair da página no meio, a requisição
                // ainda chega. O Worker responde assim que grava o lead.
                keepalive: true
            })
            .then((res) => {
                if (!res.ok) console.error('Lead recusado pelo servidor: HTTP ' + res.status);
                window.location.href = CUPOM_URL;
            })
            .catch((error) => {
                console.error('Erro ao enviar lead:', error);
                // Fallback: always redirect so the user is never locked out of the coupon page
                window.location.href = CUPOM_URL;
            });
        } else {
            window.location.href = CUPOM_URL;
        }
    });

    // Run initial UI state — sem foco e sem rolagem: a pessoa começa pelo
    // banner e pela oferta, não pelo campo.
    goToStep(1, 'forward', { initial: true });
    updateNextButtonForStep(1);
    updateSubmitState();
});
