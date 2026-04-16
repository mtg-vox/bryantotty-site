// Mobile menu toggle
const menuBtn = document.getElementById('menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });
}

// Scroll reveal animation
const revealElements = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1 });

revealElements.forEach(el => observer.observe(el));

// Contact form submission (AJAX with Formspree)
const contactForm = document.getElementById('contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const btn = document.getElementById('submit-btn');
        const successMsg = document.getElementById('form-success');
        const errorMsg = document.getElementById('form-error');
        btn.textContent = 'SENDING...';
        btn.disabled = true;

        fetch(contactForm.action, {
            method: 'POST',
            body: new FormData(contactForm),
            headers: { 'Accept': 'application/json' }
        }).then(function(response) {
            if (response.ok) {
                contactForm.reset();
                successMsg.classList.remove('hidden');
                errorMsg.classList.add('hidden');
                btn.textContent = 'SENT ✓';
            } else {
                throw new Error('Form submission failed');
            }
        }).catch(function() {
            errorMsg.classList.remove('hidden');
            successMsg.classList.add('hidden');
            btn.textContent = 'SEND MESSAGE';
            btn.disabled = false;
        });
    });
}
