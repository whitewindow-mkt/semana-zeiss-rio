document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    lucide.createIcons();

    // Cinematic Split Shutter Intro Transition
    const introShutter = document.getElementById('intro-shutter');
    if (introShutter) {
        // Logo is immediately visible on white, then shutter splits after 650ms
        setTimeout(() => {
            introShutter.classList.add('intro-out');
            document.body.classList.add('intro-completed');
        }, 650);
        
        // Remove from DOM entirely after transitions finish
        setTimeout(() => {
            introShutter.style.display = 'none';
        }, 1800);
    } else {
        document.body.classList.add('intro-completed');
    }

    // Webhook configuration for leads integration (e.g. Google Apps Script, Make, Zapier or HSales API)
    const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwA-h4CKdE8bIzkoh5WrxVcuM77FLFmJhQag2yMrdypD2ReFxEQl0K6DtomjyM7fFH5/exec'; // Insira aqui a URL do seu webhook

    // DOM Elements
    const bgContainer = document.getElementById('bg-container');
    const progressFill = document.getElementById('progress-fill');
    const stepCounter = document.getElementById('step-counter');
    const voucherBlurContent = document.getElementById('voucher-blur-content');

    // Form inputs (Only 4 fields now!)
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

    const fieldByStep = { 1: 'nome', 2: 'whatsapp', 3: 'email', 4: 'loja' };

    // Progression map (Current Step -> Voucher Blur, Page Bg Blur)
    const progressionMap = {
        1: { voucherBlur: '7px', bgBlur: '6px' },    // Step 1 active (initial blur is lighter so client knows it is a coupon)
        2: { voucherBlur: '5px', bgBlur: '4px' },    // Step 2 active
        3: { voucherBlur: '3.5px', bgBlur: '2.5px' },// Step 3 active
        4: { voucherBlur: '2px', bgBlur: '1.5px' }   // Step 4 active (still slightly locked to encourage submission)
    };

    function updateVoucherPreview() {
        const { validity } = checkFieldsValidity();

        // Progressive blur: sharpens a bit with each step advanced (not on every keystroke).
        // Full reveal happens on the next page (obrigado.html) right after "Gerar meu cupom".
        const config = progressionMap[currentStep];
        if (config) {
            if (voucherBlurContent) voucherBlurContent.style.filter = `blur(${config.voucherBlur})`;
            bgContainer.style.filter = `blur(${config.bgBlur})`;
        }

        if (btnSubmitForm) {
            btnSubmitForm.disabled = !validity.loja;
        }
    }

    // -------------------------------------------------------------
    // QUIZ STEP NAVIGATION
    // -------------------------------------------------------------

    function goToStep(stepNumber, direction) {
        // 1. Force blur on the active input to close mobile keyboard and help reset zoom
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }

        // 2. Viewport Reset Trick & Scroll after keyboard slides down (350ms delay)
        setTimeout(() => {
            const viewport = document.querySelector('meta[name="viewport"]');
            if (viewport) {
                viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
                setTimeout(() => {
                    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
                }, 100);
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 350);

        const dir = direction || (stepNumber >= currentStep ? 'forward' : 'back');
        currentStep = stepNumber;

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

        // Focus the current step's field for fast keyboard-driven completion
        const activeField = document.getElementById(fieldByStep[stepNumber]);
        if (activeField) {
            const delay = document.body.classList.contains('intro-completed') ? 350 : 1400;
            setTimeout(() => activeField.focus(), delay);
        }

        // Update voucher focus/blur when changing step
        updateVoucherPreview();
    }

    function updateNextButtonForStep(stepNumber) {
        const stepEl = steps.find((el) => Number(el.dataset.step) === stepNumber);
        if (!stepEl) return;
        const nextBtn = stepEl.querySelector('[data-next]');
        if (!nextBtn) return;

        const { validity } = checkFieldsValidity();
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

    nomeInput.addEventListener('input', () => { updateNextButtonForStep(1); updateVoucherPreview(); });
    emailInput.addEventListener('input', () => { updateNextButtonForStep(3); updateVoucherPreview(); });
    lojaSelect.addEventListener('change', () => { updateVoucherPreview(); });

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

        updateNextButtonForStep(2);
        updateVoucherPreview();
    });

    // Trocar de pais: liga/desliga a mascara BR e ajusta o placeholder
    if (countrySelect) {
        countrySelect.addEventListener('change', () => {
            const isBrazil = countrySelect.value === '55';
            whatsappInput.value = whatsappInput.value.replace(/\D/g, '');
            whatsappInput.placeholder = isBrazil ? '(00) 00000-0000' : 'Número com DDD/código local';
            if (isBrazil) whatsappInput.dispatchEvent(new Event('input', { bubbles: true }));
            updateNextButtonForStep(2);
            updateVoucherPreview();
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

        // Construct lead payload
        const leadData = {
            nome: nome,
            whatsapp: whatsapp,
            paisCodigo: paisCodigo,
            email: email,
            receita: 'exame', // Leads default to scheduling examination validation on thanks page
            loja: loja,
            timestamp: new Date().toISOString(),
            origem: 'Semana Zeiss'
        };

        // Save locally to display on thank you page
        localStorage.setItem('zeiss_lead_data', JSON.stringify(leadData));

        if (WEBHOOK_URL) {
            // Show loading state to prevent double submits and show background progress
            if (btnSubmitForm) {
                btnSubmitForm.disabled = true;
                btnSubmitForm.innerHTML = `Gerando cupom... <i data-lucide="loader" class="spin" style="width: 15px; height: 15px; vertical-align: middle; margin-left: 5px;"></i>`;
                if (window.lucide) window.lucide.createIcons();
            }

            fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(leadData),
                mode: 'no-cors' // Crucial: prevents CORS blockage when sending to Google Apps Script / webhooks
            })
            .then(() => {
                window.location.href = 'obrigado.html';
            })
            .catch((error) => {
                console.error('Erro ao enviar lead:', error);
                // Fallback: always redirect so the user is never locked out of the thank you page
                window.location.href = 'obrigado.html';
            });
        } else {
            // Um clique so: gera o cupom e ja abre a pagina de confirmacao (confete la faz a festa)
            window.location.href = 'obrigado.html';
        }
    });

    // Run initial UI state
    goToStep(1);
    updateNextButtonForStep(1);
    updateVoucherPreview();
});
