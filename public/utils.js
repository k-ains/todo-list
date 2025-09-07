// utils.js — use Worker proxy + resilient JSON parse
(function(){
  const API_ROOT = 'https://dcism-proxy.kaina-gutz.workers.dev';

  const $  = (sel, el=document) => el.querySelector(sel);
  const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));
  const qs = (obj={}) => new URLSearchParams(obj).toString();

  function toast(msg, type='info'){
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, { position:'fixed', right:'18px', bottom:'18px', padding:'10px 14px', borderRadius:'10px', background: type==='error'? '#2b1620':'#162b22', border:'1px solid '+(type==='error' ? '#6b1f2b':'#1f6b4b'), color:'#e8ecff', zIndex:9999, boxShadow:'0 10px 20px rgba(0,0,0,.3)' });
    document.body.appendChild(t);
    setTimeout(()=>t.remove(), 2300);
  }

  async function parseJson(res){
    const txt = await res.text();
    try { return JSON.parse(txt); }
    catch(err){
      console.error('Non‑JSON response from', res.url, '\n', txt);
      throw new Error((txt && txt.slice(0,160)) || `${res.status} ${res.statusText}`);
    }
  }

  async function apiGet(path, params){
    const url = API_ROOT + path + (params ? `?${qs(params)}` : '');
    const res = await fetch(url, { method: 'GET', headers: { 'Accept':'application/json' } });
    return parseJson(res);
  }

async function apiSend(method, path, body, asForm = false){
  const url  = API_ROOT + path;
  const init = { method, headers: { 'Accept': 'application/json' } };
  if (body && method !== 'GET' && method !== 'HEAD'){
    if (asForm){
      init.headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
      init.body = new URLSearchParams(body).toString();
    } else {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
  }
  const res = await fetch(url, init);
  const txt = await res.text();
  try { return JSON.parse(txt); }
  catch { console.log('RAW:', txt); throw new Error(txt.slice(0,200)); }
  
}

  function saveSession(user){ localStorage.setItem('dcism_user', JSON.stringify(user)); }
  function loadSession(){ const raw = localStorage.getItem('dcism_user'); return raw ? JSON.parse(raw) : null; }
  function requireAuth(){ const u = loadSession(); if (!u || !u.id){ window.location.href = 'index.html'; return null; } return u; }
  function logout(){ localStorage.removeItem('dcism_user'); window.location.href = 'index.html'; }

  window.App = { API_ROOT, $, $$, qs, toast, apiGet, apiSend, saveSession, loadSession, requireAuth, logout };
})();

// Ensure header logout always binds
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('logout');
  if (btn && typeof window.App?.logout === 'function') btn.addEventListener('click', window.App.logout);
  
  // Dark mode functionality
  initDarkMode();
  
  // Mobile menu functionality
  initMobileMenu();
});

function initMobileMenu() {
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  const body = document.body;
  
  if (!mobileMenuToggle || !sidebar) {
    console.log('Mobile menu elements not found');
    return;
  }
  
  console.log('Initializing mobile menu...');
  
  // Create overlay element if it doesn't exist
  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    body.appendChild(overlay);
  }
  
  function toggleMobileMenu() {
    const isOpen = sidebar.classList.contains('mobile-open');
    
    console.log('Toggling mobile menu, currently open:', isOpen);
    
    if (isOpen) {
      // Close menu
      sidebar.classList.remove('mobile-open');
      overlay.classList.remove('active');
      mobileMenuToggle.classList.remove('active');
      body.style.overflow = '';
      console.log('Menu closed');
    } else {
      // Open menu
      sidebar.classList.add('mobile-open');
      overlay.classList.add('active');
      mobileMenuToggle.classList.add('active');
      body.style.overflow = 'hidden';
      console.log('Menu opened');
    }
  }
  
  // Toggle menu on button click
  mobileMenuToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMobileMenu();
  });
  
  // Close menu when clicking overlay
  overlay.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (sidebar.classList.contains('mobile-open')) {
      toggleMobileMenu();
    }
  });
  
  // Close menu when clicking sidebar links
  sidebar.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' && sidebar.classList.contains('mobile-open')) {
      setTimeout(() => toggleMobileMenu(), 100); // Small delay for better UX
    }
  });
  
  // Close menu on window resize if it gets too large
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 992 && sidebar.classList.contains('mobile-open')) {
      toggleMobileMenu();
    }
  });
  
  // Handle escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('mobile-open')) {
      toggleMobileMenu();
    }
  });
  
  console.log('Mobile menu initialized successfully');
}

function initDarkMode() {
  const themeToggle = document.getElementById('theme-toggle');
  const body = document.body;
  
  // Check for saved theme preference or default to light mode
  const savedTheme = localStorage.getItem('theme') || 'light';
  setTheme(savedTheme);
  
  // Add click event listener to toggle button
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = body.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      setTheme(newTheme);
    });
  }
}

function setTheme(theme) {
  const body = document.body;
  const themeToggle = document.getElementById('theme-toggle');
  
  if (theme === 'dark') {
    body.setAttribute('data-theme', 'dark');
    if (themeToggle) themeToggle.textContent = '☀️';
    if (themeToggle) themeToggle.title = 'Switch to light mode';
  } else {
    body.removeAttribute('data-theme');
    if (themeToggle) themeToggle.textContent = '🌙';
    if (themeToggle) themeToggle.title = 'Switch to dark mode';
  }
  
  // Save theme preference
  localStorage.setItem('theme', theme);
}
