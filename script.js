// Mobile Navigation Toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

// Fetch and display notices
const API_URL = 'https://bncc-2.onrender.com';

async function loadNotices() {
  const container = document.getElementById('notices-container');
  if (!container) return;

  try {
    const res = await fetch(API_URL + '/notices');
    const data = await res.json();

    if (data.notices && data.notices.length > 0) {
      container.innerHTML = data.notices.map(notice => formatNotice(notice)).join('');
    } else {
      container.innerHTML = `
        <div class="notice-placeholder scroll-reveal-up">
          <div class="notice-item">
            <h4>No Notices Available</h4>
            <p>Check back later for updates from BMARPC Air Wing administration.</p>
          </div>
        </div>
      `;
    }
  } catch (e) {
    container.innerHTML = `
      <div class="notice-placeholder scroll-reveal-up">
        <div class="notice-item">
          <h4>Error Loading Notices</h4>
          <p>Unable to load notifications. Please check your connection.</p>
        </div>
      </div>
    `;
  }
}

function formatNotice(notice) {
  const date = new Date(notice.createdAt).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  let typeClass = 'info';
  if (notice.type === 'urgent') typeClass = 'urgent';
  else if (notice.type === 'upcoming') typeClass = 'upcoming';

  return `
    <div class="notice-item scroll-reveal stagger-${notice._id}">
      <div class="notice-header">
        <span class="notice-date">${date}</span>
        <span class="notice-type ${typeClass}">${notice.type.toUpperCase()}</span>
      </div>
      <h4>${notice.title}</h4>
      <p>${notice.content}</p>
      ${notice.imageUrl ? `<img src="${notice.imageUrl}" alt="${notice.title}" class="notice-image">` : ''}
    </div>
  `;
}

loadNotices();

hamburger?.addEventListener('click', () => {
  navMenu.classList.toggle('active');
});

// Close nav when clicking a link
document.querySelectorAll('.nav-menu a').forEach(link => {
  link.addEventListener('click', () => {
    navMenu.classList.remove('active');
  });
});

// Active nav on scroll
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-menu a');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(section => {
    const sectionTop = section.offsetTop - 120;
    if (scrollY >= sectionTop) current = section.getAttribute('id');
  });
  navLinks.forEach(link => {
    if (link.getAttribute('href') === `#${current}`) {
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    }
  });
});

// Enrollment Form Submission
const enrollForm = document.getElementById('enrollForm');
const formResponse = document.getElementById('formResponse');

enrollForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = enrollForm.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Submitting Application...';
  submitBtn.disabled = true;

  try {
    // Send to Netlify Forms: Netlify intercepts the POST and captures the submission
    const submission = new FormData(enrollForm);
    submission.append('submittedAt', new Date().toISOString());
    await fetch(window.location.href, {
      method: 'POST',
      body: submission,
      headers: { 'Accept': 'application/json' },
    });
    formResponse.innerHTML = '<span style="color:#2e7d32;">✅ Application submitted successfully! The Platoon Commander will review and contact you soon.</span>';
    enrollForm.reset();
  } catch (err) {
    console.error('Form submission failed:', err);
    formResponse.innerHTML = '<span style="color:#c62828;">⚠️ Something went wrong. Please try again or contact us via the notice page.</span>';
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
    setTimeout(() => { formResponse.innerHTML = ''; }, 6000);
  }
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const targetId = this.getAttribute('href');
    if (targetId === '#') return;
    const target = document.querySelector(targetId);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// Scroll reveal animation using Intersection Observer
const scrollRevealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.15 });

const scrollRevealElements = document.querySelectorAll('.scroll-reveal, .scroll-reveal-up');
scrollRevealElements.forEach(el => {
  scrollRevealObserver.observe(el);
});

// Legacy scroll reveal for elements using opacity/transform (CSS transition-based)
const legacyObserverOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
const legacyObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, legacyObserverOptions);

document.querySelectorAll('.card, .leader-card, .gallery-item, .stat-box, .feature-item, .rank-box, .card-sm').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(25px)';
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  legacyObserver.observe(el);
});

// Section header reveal on scroll
const sectionHeaders = document.querySelectorAll('.section-header');
const headerObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.2 });

sectionHeaders.forEach(header => {
  headerObserver.observe(header);
});

// Staggered gallery animations (CSS handles delays)
window.addEventListener('load', () => {
  setTimeout(() => {
    const galleryItems = document.querySelectorAll('.gallery-item');
    galleryItems.forEach((el, index) => {
      el.style.animationDelay = `${0.1 + (index * 0.05)}s`;
    });
  }, 100);
});