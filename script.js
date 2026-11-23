// Mobile Navigation Toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

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
  
  // Simulate API processing
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const formData = {
    name: document.getElementById('fullName').value,
    classId: document.getElementById('cadetClass').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    message: document.getElementById('message').value,
    submittedAt: new Date().toISOString()
  };
  
  // Save to localStorage simulation
  let applications = JSON.parse(localStorage.getItem('bmarpc_airwing_applications') || '[]');
  applications.push(formData);
  localStorage.setItem('bmarpc_airwing_applications', JSON.stringify(applications));
  
  formResponse.innerHTML = '<span style="color:#2e7d32;">✅ Application submitted successfully! The Platoon Commander will review and contact you soon.</span>';
  enrollForm.reset();
  submitBtn.textContent = originalText;
  submitBtn.disabled = false;
  
  setTimeout(() => { formResponse.innerHTML = ''; }, 6000);
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

// Scroll reveal animation
const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, observerOptions);

document.querySelectorAll('.card, .leader-card, .gallery-item, .stat-box, .feature-item, .rank-box').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(25px)';
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(el);
});


