const STRIPE_PUBLISHABLE_KEY = 'pk_test_51RBfArKd8Y7mN3xLq2pZwVcT0aB1nC4dE5fG6hI7jK8lM9oP0qRsTuVwXyZaBcDeFgHiJkLmNoPqRsTuVwXyZ';
const authCard = document.getElementById('authCard');
const stateLogin = document.getElementById('stateLogin');
const stateRegister = document.getElementById('stateRegister');
const stateVerify = document.getElementById('stateVerify');
const statePayment = document.getElementById('statePayment');
const stateSuccess = document.getElementById('stateSuccess');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const verifyForm = document.getElementById('verifyForm');
const paymentForm = document.getElementById('paymentForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginEmailError = document.getElementById('loginEmailError');
const loginPasswordError = document.getElementById('loginPasswordError');
const loginBtn = document.getElementById('loginBtn');
const regUsername = document.getElementById('regUsername');
const regEmail = document.getElementById('regEmail');
const regPassword = document.getElementById('regPassword');
const regUsernameError = document.getElementById('regUsernameError');
const regEmailError = document.getElementById('regEmailError');
const regPasswordError = document.getElementById('regPasswordError');
const registerBtn = document.getElementById('registerBtn');
const codeDigits = document.querySelectorAll('.code-digit');
const verifyCodeError = document.getElementById('verifyCodeError');
const verifyEmailDisplay = document.getElementById('verifyEmailDisplay');
const verifyBtn = document.getElementById('verifyBtn');
const codeInputContainer = document.getElementById('codeInputContainer');
const cardElementDiv = document.getElementById('cardElement');
const cardError = document.getElementById('cardError');
const paymentBtn = document.getElementById('paymentBtn');
const goToRegister = document.getElementById('goToRegister');
const goToLogin = document.getElementById('goToLogin');
const resendCode = document.getElementById('resendCode');
const backToRegisterFromVerify = document.getElementById('backToRegisterFromVerify');
const backToVerifyFromPayment = document.getElementById('backToVerifyFromPayment');
const goToDashboard = document.getElementById('goToDashboard');
const toggleLoginPassword = document.getElementById('toggleLoginPassword');
const toggleRegPassword = document.getElementById('toggleRegPassword');
let currentState = 'login';
let registeredEmail = '';
let registeredUsername = '';
let registeredPassword = '';
let stripe = null;
let elements = null;
let cardElement = null;
let stripeMounted = false;

function initStripe() {
    if (STRIPE_PUBLISHABLE_KEY && STRIPE_PUBLISHABLE_KEY.startsWith('pk_')) {
        try {
            stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
            elements = stripe.elements({
                locale: 'fr',
            });
            console.log('✅ Stripe initialisé avec succès.');
            return true;
        } catch (err) {
            console.warn('⚠️ Erreur d\'initialisation Stripe :', err.message);
            return false;
        }
    } else {
        console.warn('⚠️ Clé publique Stripe non configurée. Le paiement fonctionnera en mode simulé.');
        return false;
    }
}

function mountStripeCard() {
    if (!stripe || !elements || stripeMounted) return;
    try {
        cardElement = elements.create('card', {
            style: {
                base: {
                    fontFamily: '"Inter", -apple-system, sans-serif',
                    fontSize: '15px',
                    fontWeight: '400',
                    color: '#1a1b23',
                    '::placeholder': {
                        color: '#9ca3af',
                    },
                    iconColor: '#FF6D5A',
                },
                invalid: {
                    color: '#ef4444',
                    iconColor: '#ef4444',
                },
            },
            hidePostalCode: true,
        });
        cardElement.mount('#cardElement');
        stripeMounted = true;
        cardElement.on('change', function (event) {
            if (event.error) {
                showFieldError(cardError, event.error.message);
            } else {
                hideFieldError(cardError);
            }
        });
        console.log('✅ Élément carte Stripe monté.');
    } catch (err) {
        console.warn('⚠️ Impossible de monter l\'élément Stripe :', err.message);
        cardElementDiv.innerHTML =
            '<input type="text" class="input-field" placeholder="Numéro de carte (simulation)" style="padding-left:14px;">';
    }
}

function unmountStripeCard() {
    if (cardElement && stripeMounted) {
        cardElement.unmount();
        stripeMounted = false;
        cardElement = null;
    }
    cardElementDiv.innerHTML = '';
}

const stripeAvailable = initStripe();

function showState(stateName) {
    const states = {
        login: stateLogin,
        register: stateRegister,
        verify: stateVerify,
        payment: statePayment,
        success: stateSuccess,
    };
    Object.values(states).forEach((el) => { if (el) { el.style.display = 'none'; el.classList.remove('fade-in'); }});
    const target = states[stateName];
    if (target) {
        target.style.display = 'block';
        target.classList.add('fade-in');
    }
    currentState = stateName;
    if (stateName === 'payment') {
        mountStripeCard();
    } else {
        unmountStripeCard();
    }
    if (stateName === 'verify') { setTimeout(() => { const firstDigit = document.querySelector('.code-digit[data-index="0"]'); if (firstDigit) firstDigit.focus(); }, 300);}
    clearAllErrors();
}

function clearAllErrors() {
    document.querySelectorAll('.input-error').forEach((el) => {
        el.classList.remove('visible');
        el.textContent = '';
    });
    document.querySelectorAll('.input-field.input-error-state, .code-digit.input-error-state').forEach((el) => {
        el.classList.remove('input-error-state');
    });
    cardError.classList.remove('visible');
    cardError.textContent = '';
}

function showFieldError(element, message) {
    if (!element) return;
    element.textContent = message;
    element.classList.add('visible');
}

function hideFieldError(element) {
    if (!element) return;
    element.textContent = '';
    element.classList.remove('visible');
}

function markInputError(input) { if (input) input.classList.add('input-error-state'); }

function unmarkInputError(input) { if (input) input.classList.remove('input-error-state'); }

function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

function validateLoginForm() {
    let valid = true;
    clearAllErrors();
    if (!loginEmail.value.trim()) {
        showFieldError(loginEmailError, 'L\'email est requis.');
        markInputError(loginEmail);
        valid = false;
    } else if (!isValidEmail(loginEmail.value.trim())) {
        showFieldError(loginEmailError, 'Format d\'email invalide.');
        markInputError(loginEmail);
        valid = false;
    } else {
        unmarkInputError(loginEmail);
    }

    if (!loginPassword.value) {
        showFieldError(loginPasswordError, 'Le mot de passe est requis.');
        markInputError(loginPassword);
        valid = false;
    } else {
        unmarkInputError(loginPassword);
    }

    return valid;
}

function validateRegisterForm() {
    let valid = true;
    clearAllErrors();
    if (!regUsername.value.trim() || regUsername.value.trim().length < 3) {
        showFieldError(regUsernameError, 'Le nom d\'utilisateur doit comporter au moins 3 caractères.');
        markInputError(regUsername);
        valid = false;
    } else {
        unmarkInputError(regUsername);
    }
    if (!regEmail.value.trim()) {
        showFieldError(regEmailError, 'L\'email est requis.');
        markInputError(regEmail);
        valid = false;
    } else if (!isValidEmail(regEmail.value.trim())) {
        showFieldError(regEmailError, 'Format d\'email invalide.');
        markInputError(regEmail);
        valid = false;
    } else {
        unmarkInputError(regEmail);
    }
    if (!regPassword.value || regPassword.value.length < 8) {
        showFieldError(regPasswordError, 'Le mot de passe doit comporter au moins 8 caractères.');
        markInputError(regPassword);
        valid = false;
    } else {
        unmarkInputError(regPassword);
    }
    return valid;
}

function getVerificationCode() {
    let code = '';
    codeDigits.forEach((digit) => {
        code += digit.value;
    });
    return code;
}

function validateVerifyForm() {
    const code = getVerificationCode();
    clearAllErrors();

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
        showFieldError(verifyCodeError, 'Veuillez entrer le code à 6 chiffres complet.');
        codeDigits.forEach((d) => {
            if (!d.value) d.classList.add('input-error-state');
        });
        return false;
    }

    codeDigits.forEach((d) => d.classList.remove('input-error-state'));
    return true;
}

function setButtonLoading(btn, isLoading) {
    const btnText = btn.querySelector('.btn-text');
    const btnSpinner = btn.querySelector('.btn-spinner');
    if (isLoading) {
        btn.disabled = true;
        btnText.style.display = 'none';
        btnSpinner.style.display = 'flex';
        btnSpinner.style.alignItems = 'center';
        btnSpinner.style.justifyContent = 'center';
    } else {
        btn.disabled = false;
        btnText.style.display = '';
        btnSpinner.style.display = 'none';
    }
}

function showToast(message, type = 'info', duration = 4000) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
        toast.classList.add('visible');
    });
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 400);
    }, duration);
}

async function apiCall(url, data, method = 'POST') {
    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || `Erreur ${response.status}`);
        }
        return { success: true, data: result };
    } catch (err) {
        if (err.name === 'TypeError' && err.message.includes('fetch')) {
            console.warn('📍 Mode démo : simulation de réponse API pour', url);
            return { success: true, data: { message: 'OK (simulé)', demo: true } };
        }
        return { success: false, error: err.message };
    }
}

goToRegister.addEventListener('click', (e) => {
    e.preventDefault();
    clearAllErrors();
    registerForm.reset();
    showState('register');
    setTimeout(() => regUsername.focus(), 350);
});

goToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    clearAllErrors();
    loginForm.reset();
    showState('login');
    setTimeout(() => loginEmail.focus(), 350);
});

backToRegisterFromVerify.addEventListener('click', (e) => {
    e.preventDefault();
    clearAllErrors();
    // Réaffiche le formulaire d'inscription avec les données précédentes
    regUsername.value = registeredUsername;
    regEmail.value = registeredEmail;
    regPassword.value = registeredPassword;
    resetCodeDigits();
    showState('register');
});

backToVerifyFromPayment.addEventListener('click', (e) => {
    e.preventDefault();
    clearAllErrors();
    resetCodeDigits();
    showState('verify');
    setTimeout(() => {
        const firstDigit = document.querySelector('.code-digit[data-index="0"]');
        if (firstDigit) firstDigit.focus();
    }, 350);
});

resendCode.addEventListener('click', async (e) => {
    e.preventDefault();
    showToast('Nouveau code envoyé à ' + registeredEmail, 'info');
    await apiCall('/SendEmail', {
        username: registeredUsername,
        email: registeredEmail,
        password: registeredPassword,
    });
    resetCodeDigits();
    setTimeout(() => {
        const firstDigit = document.querySelector('.code-digit[data-index="0"]');
        if (firstDigit) firstDigit.focus();
    }, 200);
});

goToDashboard.addEventListener('click', (e) => {
    e.preventDefault();
    showToast('Redirection vers le tableau de bord...', 'success');
    setTimeout(() => {
        window.location.href = '/dashboard';
    }, 1500);
});

toggleLoginPassword.addEventListener('click', () => {
    const type = loginPassword.getAttribute('type') === 'password' ? 'text' : 'password';
    loginPassword.setAttribute('type', type);
    toggleLoginPassword.classList.toggle('password-visible', type === 'text');
});

toggleRegPassword.addEventListener('click', () => {
    const type = regPassword.getAttribute('type') === 'password' ? 'text' : 'password';
    regPassword.setAttribute('type', type);
    toggleRegPassword.classList.toggle('password-visible', type === 'text');
});

function resetCodeDigits() {
    codeDigits.forEach((d) => {
        d.value = '';
        d.classList.remove('filled', 'input-error-state');
    });
    hideFieldError(verifyCodeError);
}

codeDigits.forEach((digit) => {
    digit.addEventListener('input', (e) => {
        const value = e.target.value;
        if (!/^\d$/.test(value)) {
            e.target.value = '';
            return;
        }
        e.target.value = value.slice(-1);
        digit.classList.add('filled');
        const index = parseInt(digit.getAttribute('data-index'));
        if (index < 5) {
            const next = document.querySelector(`.code-digit[data-index="${index + 1}"]`);
            if (next) next.focus();
        }
        hideFieldError(verifyCodeError);
        codeDigits.forEach((d) => d.classList.remove('input-error-state'));
    });
    digit.addEventListener('keydown', (e) => {
        const index = parseInt(digit.getAttribute('data-index'));
        if (e.key === 'Backspace' && !digit.value && index > 0) {
            const prev = document.querySelector(`.code-digit[data-index="${index - 1}"]`);
            if (prev) {
                prev.focus();
                prev.value = '';
                prev.classList.remove('filled');
                e.preventDefault();
            }
        }
        if (e.key === 'ArrowLeft' && index > 0) {
            const prev = document.querySelector(`.code-digit[data-index="${index - 1}"]`);
            if (prev) prev.focus();
            e.preventDefault();
        }
        if (e.key === 'ArrowRight' && index < 5) {
            const next = document.querySelector(`.code-digit[data-index="${index + 1}"]`);
            if (next) next.focus();
            e.preventDefault();
        }
    });
    digit.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData).getData('text');
        const digits = pasteData.replace(/\D/g, '').slice(0, 6).split('');
        digits.forEach((d, i) => {
            const target = document.querySelector(`.code-digit[data-index="${i}"]`);
            if (target) {
                target.value = d;
                target.classList.add('filled');
            }
        });
        const lastFilledIndex = Math.min(digits.length, 5);
        const focusTarget = document.querySelector(`.code-digit[data-index="${lastFilledIndex}"]`);
        if (focusTarget) focusTarget.focus();
        hideFieldError(verifyCodeError);
        codeDigits.forEach((d) => d.classList.remove('input-error-state'));
    });

    digit.addEventListener('focus', () => {
        digit.select();
    });
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateLoginForm()) return;
    setButtonLoading(loginBtn, true);
    const result = await apiCall('/Login', {
        email: loginEmail.value.trim(),
        password: loginPassword.value,
    });
    setButtonLoading(loginBtn, false);
    if (result.success) {
        showToast('Connexion réussie ! Redirection...', 'success');
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 1200);
    } else {
        showToast(result.error || 'Échec de la connexion. Vérifiez vos identifiants.', 'error');
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateRegisterForm()) return;
    registeredUsername = regUsername.value.trim();
    registeredEmail = regEmail.value.trim();
    registeredPassword = regPassword.value;
    setButtonLoading(registerBtn, true);
    const result = await apiCall('/SendEmail', {
        username: registeredUsername,
        email: registeredEmail,
        password: registeredPassword,
    });
    setButtonLoading(registerBtn, false);
    if (result.success) {
        verifyEmailDisplay.innerHTML =
            'Nous avons envoyé un code à 6 chiffres à <strong>' + registeredEmail + '</strong>';
        resetCodeDigits();
        showState('verify');
        showToast('Code de vérification envoyé !', 'success');
    } else {
        showToast(result.error || 'Erreur lors de l\'envoi du code. Réessayez.', 'error');
    }
});

verifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateVerifyForm()) return;
    const code = getVerificationCode();
    setButtonLoading(verifyBtn, true);
    const result = await apiCall('/CheckEmail', {
        email: registeredEmail,
        code: code,
    });
    setButtonLoading(verifyBtn, false);
    if (result.success) {
        showToast('Email vérifié avec succès !', 'success');
        showState('payment');
    } else {
        showFieldError(verifyCodeError, result.error || 'Code incorrect. Veuillez réessayer.');
        codeDigits.forEach((d) => d.classList.add('input-error-state'));
        setTimeout(() => {
            resetCodeDigits();
            const firstDigit = document.querySelector('.code-digit[data-index="0"]');
            if (firstDigit) firstDigit.focus();
        }, 800);
    }
});

paymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!stripe || !cardElement || !stripeMounted) {
        setButtonLoading(paymentBtn, true);
        showToast('Traitement du paiement (mode démo)...', 'info');
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setButtonLoading(paymentBtn, false);
        showToast('Paiement accepté ! Bienvenue ! 🎉', 'success');
        showState('success');
        return;
    }
    setButtonLoading(paymentBtn, true);
    hideFieldError(cardError);
    try {
        const { error, paymentMethod } = await stripe.createPaymentMethod({
            type: 'card',
            card: cardElement,
        });
        if (error) {
            showFieldError(cardError, error.message);
            setButtonLoading(paymentBtn, false);
            return;
        }
        const result = await apiCall('/ProcessPayment', {
            email: registeredEmail,
            username: registeredUsername,
            paymentMethodId: paymentMethod.id,
            plan: 'pro',
            amount: 200,
        });
        if (result.success) {
            showToast('Paiement accepté ! Bienvenue ! 🎉', 'success');
            showState('success');
        } else {
            showFieldError(cardError, result.error || 'Le paiement a échoué. Vérifiez vos informations.');
        }
    } catch (err) {
        showFieldError(cardError, 'Une erreur est survenue. Veuillez réessayer.');
        console.error('Erreur de paiement :', err);
    }
    setButtonLoading(paymentBtn, false);
});

[loginEmail, loginPassword].forEach((input) => {
    input.addEventListener('input', () => {
        unmarkInputError(input);
        hideFieldError(loginEmailError);
        hideFieldError(loginPasswordError);
    });
    input.addEventListener('focus', () => {
        unmarkInputError(input);
        hideFieldError(loginEmailError);
        hideFieldError(loginPasswordError);
    });
});

[regUsername, regEmail, regPassword].forEach((input) => {
    input.addEventListener('input', () => {
        unmarkInputError(input);
        hideFieldError(regUsernameError);
        hideFieldError(regEmailError);
        hideFieldError(regPasswordError);
    });
    input.addEventListener('focus', () => {
        unmarkInputError(input);
        hideFieldError(regUsernameError);
        hideFieldError(regEmailError);
        hideFieldError(regPasswordError);
    });
});

document.addEventListener('DOMContentLoaded', () => {
    showState('login');
    setTimeout(() => loginEmail.focus(), 400);
    console.log('🚀 Application n8n Auth prête.');
    console.log('📋 Flux : Login ↔ Register → /SendEmail → Code 6 chiffres → /CheckEmail → Paiement Stripe');
    if (!stripeAvailable) {
        console.log('💡 Le paiement Stripe fonctionnera en mode simulé. Configurez STRIPE_PUBLISHABLE_KEY pour le mode réel.');
    }
});