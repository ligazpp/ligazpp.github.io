/**
 * Интерактивность для ligazpp-test (Eleventy многостраничная версия)
 */
(function () {
    'use strict';

    // --- Мобильное меню ---
    const menuToggle = document.getElementById('menuToggle');
    const siteNav = document.getElementById('siteNav');

    if (menuToggle && siteNav) {
        menuToggle.addEventListener('click', () => {
            const isOpen = siteNav.classList.toggle('nav--active');
            menuToggle.setAttribute('aria-expanded', String(isOpen));
        });

        // Закрываем меню после перехода по ссылке
        siteNav.addEventListener('click', (e) => {
            if (e.target.matches('.nav a[href]')) {
                siteNav.classList.remove('nav--active');
                menuToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // --- Кнопка «Наверх» ---
    const scrollTopBtn = document.getElementById('scrollTopBtn');

    if (scrollTopBtn) {
        window.addEventListener('scroll', () => {
            scrollTopBtn.classList.toggle('show', window.scrollY > 400);
        }, { passive: true });

        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // --- FAQ-аккордеон ---
    function toggleFaq(question) {
        const answer = document.getElementById(question.getAttribute('aria-controls'));
        const isOpen = question.getAttribute('aria-expanded') === 'true';

        document.querySelectorAll('.faq-question[aria-expanded="true"]').forEach(q => {
            if (q !== question) {
                q.setAttribute('aria-expanded', 'false');
                const other = document.getElementById(q.getAttribute('aria-controls'));
                if (other) other.hidden = true;
            }
        });

        question.setAttribute('aria-expanded', String(!isOpen));
        if (answer) answer.hidden = isOpen;
    }

    document.addEventListener('click', (e) => {
        const question = e.target.closest('.faq-question');
        if (question) toggleFaq(question);
    });

    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.faq-question')) {
            e.preventDefault();
            toggleFaq(e.target);
        }
    });
})();