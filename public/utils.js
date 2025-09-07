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
});
