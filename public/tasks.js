// tasks.js — Drawer UI (rename/notes/schedule) + real PUT/DELETE through Worker proxy
(function(){
  const { $, toast, apiGet, apiSend, requireAuth, logout } = window.App;

  const state = { user: null, currentTab: 'active', items: { active: [], inactive: [] }, current: null };

  // Local schedule/notes because the API doesn't have these fields
 const SKEY = 'dcism_schedule';
const CATS_KEY = 'dcism_categories';

const loadSched = () => { try { return JSON.parse(localStorage.getItem(SKEY)||'{}'); } catch { return {}; } };
const saveSched = (obj) => localStorage.setItem(SKEY, JSON.stringify(obj));

const getCats = () => { try { return JSON.parse(localStorage.getItem(CATS_KEY)||'[]'); } catch { return []; } };
const saveCats = (arr) => localStorage.setItem(CATS_KEY, JSON.stringify(Array.from(new Set(arr.filter(Boolean)))));
const fmtDate = (s) => s ? new Date(s + 'T00:00:00').toLocaleDateString(undefined, { month:'short', day:'2-digit'}) : '';

  function renderHeader(){
    $('#hello-name').textContent = state.user.fname || state.user.first_name || 'Friend';
    const emailEl = $('#user-email'); if (emailEl) emailEl.textContent = state.user.email || '';
    const now = new Date();
    const helloTime = $('#hello-time'); if (helloTime) helloTime.textContent = now.toLocaleString(undefined, { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    const t = document.getElementById('today-str');
    if (t) t.textContent = now.toLocaleString(undefined, { weekday:'long', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' });
  }

  function badgeFor(it){
    const s = loadSched()[it.item_id] || {}; const parts=[];
    if (s.list) parts.push(s.list);
    if (s.due) parts.push(`due ${s.due}`);
    return parts.join(' • ');
  }

  function renderList(){
    const listEl = document.getElementById('list'); if (!listEl) return;
    listEl.innerHTML = '';
    const arr = state.items[state.currentTab] || [];
    
    console.log(`Rendering ${state.currentTab} tab with ${arr.length} items`);

    const tpl = document.getElementById('task-tpl');
    for (const it of arr) {
      const node = document.importNode(tpl.content, true);
      const check = node.querySelector('.check');
      const openBtn = node.querySelector('.open');
      const name = node.querySelector('.name');
      const desc = node.querySelector('.desc');

      if (state.currentTab === 'inactive' || it.status === 'inactive') check.classList.add('done');
      name.textContent = it.item_name;
      desc.textContent = it.item_description || badgeFor(it);
      const s = loadSched()[it.item_id] || {};
const dueEl = node.querySelector('.chip.due');
const catEl = node.querySelector('.chip.cat');
if (s.due) { dueEl.textContent = fmtDate(s.due); dueEl.hidden = false; } else { dueEl.hidden = true; }
if (s.category) { catEl.textContent = s.category; catEl.hidden = false; } else { catEl.hidden = true; }

      // toggle status
      check.addEventListener('click', async () => {
        const to = (it.status === 'active') ? 'inactive' : 'active';
        try {
          const res = await apiSend('PUT', '/statusItem_action.php', { status: to, item_id: it.item_id });
          if (res.status !== 200) throw new Error(res.message || 'Failed');
          toast(to==='inactive' ? 'Marked done' : 'Reactivated');
          await fetchItems();
        } catch (e) { toast('Failed to change status', 'error'); }
      });

      // open drawer for full edit/schedule
      openBtn.addEventListener('click', () => openDrawer(it));

      listEl.appendChild(node);
    }

    if (!arr.length) {
      const empty = document.createElement('div'); empty.className = 'hint';
      empty.textContent = state.currentTab==='active' ? 'No active tasks yet. Add one above!' : 'Nothing here. Completed tasks will appear in this tab.'; listEl.appendChild(empty);
    }
  }

  async function fetchItems(){
    const id = state.user.id || state.user.user_id || state.user.ID;
    const [a, i] = await Promise.all([
      apiGet('/getItems_action.php', { status: 'active', user_id: id }),
      apiGet('/getItems_action.php', { status: 'inactive', user_id: id }),
    ]);
    state.items.active   = Array.isArray(a.data) ? a.data : Object.values(a.data || {});
    state.items.inactive = Array.isArray(i.data) ? i.data : Object.values(i.data || {});
    renderCounts();
    renderList();
  }

  // -------- Drawer logic --------
function openDrawer(it){
  state.current = it;
  const s = loadSched()[it.item_id] || {};
  const drawer = document.getElementById('drawer'); if (!drawer) return;
  document.getElementById('d-title').value = it.item_name || '';
  document.getElementById('d-category').value = s.category || '';
  document.getElementById('d-due').value   = s.due || '';
  document.getElementById('d-note').value  = s.note || (it.item_description || '');

  // populate datalist from saved categories
  const dl = document.getElementById('cats');
  if (dl){
    const cats = getCats();
    dl.innerHTML = cats.map(c => `<option value="${c}">`).join('');
  }

  drawer.classList.add('open');
}

async function saveFromDrawer(){
  if(!state.current) return;
  const id = state.current.item_id;
  const title = document.getElementById('d-title').value.trim();
  const note  = document.getElementById('d-note').value.trim();
  const category = document.getElementById('d-category').value.trim();
  const due  = document.getElementById('d-due').value;

  try {
    const res = await apiSend('PUT', '/editItem_action.php', {
      item_id:id, item_name: title || state.current.item_name, item_description: note
    });
    if (res.status !== 200) throw new Error(res.message || 'Failed');

    const schedAll = loadSched();
    schedAll[id] = { ...schedAll[id], category, due, note };
    saveSched(schedAll);

    if (category){
      const cats = getCats();
      if (!cats.includes(category)) { cats.push(category); saveCats(cats); }
    }

    toast('Saved');
    closeDrawer();
    await fetchItems();
  } catch (e) { toast('Failed to save', 'error'); }
}

  function closeDrawer(){ const d=document.getElementById('drawer'); if(d) d.classList.remove('open'); state.current=null; }

  async function deleteFromDrawer(){
    if(!state.current) return;
    if(!confirm('Delete this task?')) return;
    try {
      const res = await apiSend('DELETE', `/deleteItem_action.php?item_id=${encodeURIComponent(state.current.item_id)}`);
      if (res.status !== 200) throw new Error(res.message || 'Failed');
      const schedAll = loadSched(); delete schedAll[state.current.item_id]; saveSched(schedAll);
      toast('Item deleted');
      closeDrawer();
      await fetchItems();
    } catch (e) { toast('Failed to delete', 'error'); }
  }

  // -------- Init --------
  document.addEventListener('DOMContentLoaded', () => {
    try {
      state.user = requireAuth();
      if (!state.user) { return; } // redirected already

      renderHeader();

      // Test if elements exist
      console.log('Testing element existence:');
      console.log('inbox-count exists:', !!document.getElementById('inbox-count'));
      console.log('stat-todo exists:', !!document.getElementById('stat-todo'));
      console.log('stat-done exists:', !!document.getElementById('stat-done'));

      // Add form
      const form = document.getElementById('form-add');
      if (form) {
        form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nameEl = document.getElementById('new-name');
  const descEl = document.getElementById('new-desc');
  const name = nameEl?.value.trim();
  const desc = descEl?.value.trim();
  if (!name) return;
  try {
    const uid = state.user.id || state.user.user_id;
    const res = await apiSend('POST', '/addItem_action.php', {
      item_name: name,
      item_description: desc,
      user_id: uid
    }); // JSON body
    if (res.status !== 200) throw new Error(res.message || 'Add failed');

    // NEW: save due date by item_id so chip shows right away
    const dueEl = document.getElementById('new-due');
    const due = dueEl?.value || '';
    const itemId = res?.data?.item_id;
    if (itemId && due){
      const schedAll = loadSched();
      schedAll[itemId] = { ...(schedAll[itemId]||{}), due };
      saveSched(schedAll);
    }

    // clear fields
    if (nameEl) nameEl.value = '';
    if (descEl) descEl.value = '';
    if (dueEl)  dueEl.value = '';

    toast('Task added');
    await fetchItems();
  } catch (err) {
    console.error('Add error:', err);
    toast(err.message || 'Failed to add','error');
  }
});

      }

      // Tabs
      const tabA = document.getElementById('tab-active');
      const tabI = document.getElementById('tab-inactive');
      
      function switchToActive() {
        console.log('Switching to Active tab');
        state.currentTab='active'; 
        tabA?.classList.add('active'); 
        tabI?.classList.remove('active'); 
        renderList();
        // Add haptic feedback on mobile
        if (navigator.vibrate) navigator.vibrate(50);
      }
      
      function switchToInactive() {
        console.log('Switching to Completed tab');
        state.currentTab='inactive'; 
        tabI?.classList.add('active'); 
        tabA?.classList.remove('active'); 
        renderList();
        // Add haptic feedback on mobile
        if (navigator.vibrate) navigator.vibrate(50);
      }
      
      if (tabA) {
        tabA.addEventListener('click', switchToActive);
        tabA.addEventListener('touchend', (e) => {
          e.preventDefault();
          switchToActive();
        });
      }
      
      if (tabI) {
        tabI.addEventListener('click', switchToInactive);
        tabI.addEventListener('touchend', (e) => {
          e.preventDefault();
          switchToInactive();
        });
      }

      // Drawer buttons
      document.getElementById('drawer-close')?.addEventListener('click', closeDrawer);
      document.getElementById('btn-save')?.addEventListener('click', saveFromDrawer);
      document.getElementById('btn-delete')?.addEventListener('click', deleteFromDrawer);

      // Logout
      document.getElementById('logout')?.addEventListener('click', logout);

      fetchItems().catch(err => { console.error('Initial fetch failed:', err); toast('Failed to load tasks','error'); });
    } catch (e) {
      console.error('Init error:', e);
      toast('Something went wrong in init','error');
    }
  });

  // -------- Counts (big counters + badges) --------
 function renderCounts(){
  const active = state.items.active.length;
  const inactive = state.items.inactive.length;
  
  console.log('Updating counts: active =', active, 'inactive =', inactive);

  // big numbers
  const set = (id,val)=>{ 
    const n=document.getElementById(id); 
    if(n){ 
      console.log(`Updating ${id} to ${val}`);
      n.textContent=String(val); 
      n.animate?.([{opacity:.6,transform:'scale(.98)'},{opacity:1,transform:'scale(1)'}],{duration:180,easing:'ease-out'});
    } else { 
      console.log('Element not found:', id); 
    } 
  };
  set('stat-done', inactive);
  set('stat-todo', active);
  
  // sidebar badges (only inbox since we removed other nav items)
  set('inbox-count', active);

  // helper to escape HTML
  const esc = (s)=>String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[m]));

  // build UL items (top 3)
  const asList = (arr) => {
    if (!arr.length) return '<li class="empty">None</li>';
    return arr.slice(0,3).map(x => `<li>${esc(x.item_name)}</li>`).join('');
  };

  const doneUl = document.getElementById('titles-done');
  const todoUl = document.getElementById('titles-todo');
  if (doneUl) doneUl.innerHTML = asList(state.items.inactive);
  if (todoUl) todoUl.innerHTML = asList(state.items.active);
}

})();
