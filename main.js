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
    // -------- Prefill Inquiry Type from ?type= URL param --------
    // Allowed values mirror the <select> options. Anything else is ignored.
    const inquirySelect = document.getElementById('inquiry_type');
    const subjectField = document.getElementById('_subject');
    const SUBJECTS = {
        general:    'bryantotty.com general inquiry',
        speaking:   'bryantotty.com speaking inquiry',
        services:   'bryantotty.com music marketing / artist services',
        collab:     'bryantotty.com creative collaboration',
        business:   'bryantotty.com business / advisory',
        press:      'bryantotty.com press / media',
        recruiting: 'bryantotty.com recruiting / hiring'
    };
    function syncSubject() {
        if (!subjectField || !inquirySelect) return;
        const v = inquirySelect.value;
        if (SUBJECTS[v]) subjectField.value = SUBJECTS[v];
    }
    if (inquirySelect) {
        try {
            const params = new URLSearchParams(window.location.search);
            const requested = (params.get('type') || '').toLowerCase();
            if (requested && SUBJECTS[requested]) {
                inquirySelect.value = requested;
            }
        } catch (_e) { /* no-op */ }
        syncSubject();
        inquirySelect.addEventListener('change', syncSubject);
    }

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

// ============================================================
// Merch grid renderer (Creative > Shop)
// Reads /merch.generated.json (same-origin, CSP-safe).
// Re-runs cleanly if listings are removed/added on next sync.
// ============================================================
const merchGrid = document.getElementById('merch-grid');
const merchSyncedAt = document.getElementById('merch-synced-at');
if (merchGrid) {
    fetch('merch.generated.json', { cache: 'no-cache' })
        .then(function (r) {
            if (!r.ok) throw new Error('merch fetch failed: ' + r.status);
            return r.json();
        })
        .then(function (data) {
            const items = (data && Array.isArray(data.items)) ? data.items : [];
            if (!items.length) {
                const empty = merchGrid.getAttribute('data-shop-empty')
                    || 'No items currently available.';
                merchGrid.innerHTML = '<div class="merch-empty">' + empty + '</div>';
                return;
            }

            // Render each card. We deliberately escape user-influenced strings.
            const escape = function (s) {
                return String(s == null ? '' : s)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            };

            const cards = items.map(function (item) {
                const title = escape(item.title || 'Untitled');
                const href = escape(item.href || '#');
                const img = escape(item.localImage || '');
                const price = item.price ? escape(item.price) : '';
                return ''
                    + '<a class="merch-card" href="' + href + '" target="_blank" rel="noopener noreferrer" aria-label="' + title + ', open on Etsy">'
                    +   '<div class="merch-art">'
                    +     (img
                            ? '<img class="merch-img" src="' + img + '" alt="' + title + '" loading="lazy" width="800" height="800">'
                            : '')
                    +   '</div>'
                    +   '<div class="merch-meta">'
                    +     (price ? '<span class="merch-price">' + price + '</span>' : '')
                    +     '<strong>' + title + '</strong>'
                    +     '<span class="merch-link">Shop on Etsy &#8599;</span>'
                    +   '</div>'
                    + '</a>';
            }).join('');

            merchGrid.innerHTML = cards;

            if (merchSyncedAt && data.syncedAt) {
                let when = data.syncedAt;
                try {
                    when = new Date(data.syncedAt).toLocaleDateString(undefined, {
                        year: 'numeric', month: 'short', day: 'numeric'
                    });
                } catch (_e) { /* fall back to ISO */ }
                merchSyncedAt.textContent = 'Synced ' + when;
            }
        })
        .catch(function (err) {
            console.warn('[merch] render failed:', err);
            const fallback = ''
                + '<a class="merch-card" href="https://www.etsy.com/shop/RedTigerUnlimited" target="_blank" rel="noopener noreferrer">'
                +   '<div class="merch-meta">'
                +     '<span class="merch-price">Live products</span>'
                +     '<strong>Visit the Red Tiger Unlimited storefront on Etsy</strong>'
                +     '<span class="merch-link">Shop on Etsy &#8599;</span>'
                +   '</div>'
                + '</a>';
            merchGrid.innerHTML = fallback;
        });
}
