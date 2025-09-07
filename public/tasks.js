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
    
    // Add debug indicator
    const debugEl = document.createElement('div');
    debugEl.style.cssText = 'position:fixed;top:70px;right:10px;background:red;color:white;padding:5px;z-index:9999;border-radius:4px;font-size:12px;';
    debugEl.textContent = `Tab: ${state.currentTab} (${arr.length} items)`;
    debugEl.id = 'debug-tab-indicator';
    
    // Remove existing debug indicator
    const existing = document.getElementById('debug-tab-indicator');
    if (existing) existing.remove();
    document.body.appendChild(debugEl);
    
    // Remove debug indicator after 3 seconds
    setTimeout(() => {
      const el = document.getElementById('debug-tab-indicator');
      if (el) el.remove();
    }, 3000);

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

      // Tabs - Complete rewrite for mobile compatibility
      const tabA = document.getElementById('tab-active');
      const tabI = document.getElementById('tab-inactive');
      
      function setActiveTab(newTab) {
        console.log('Setting active tab to:', newTab);
        
        // Update state
        state.currentTab = newTab;
        
        // Update visual state
        if (tabA && tabI) {
          tabA.classList.remove('active');
          tabI.classList.remove('active');
          
          if (newTab === 'active') {
            tabA.classList.add('active');
          } else {
            tabI.classList.add('active');
          }
        }
        
        // Force re-render
        setTimeout(() => {
          renderList();
          console.log('Tab switched to:', state.currentTab);
        }, 10);
        
        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(30);
      }
      
      // Remove any existing event listeners by cloning elements
      if (tabA) {
        const newTabA = tabA.cloneNode(true);
        tabA.parentNode.replaceChild(newTabA, tabA);
        
        // Add all event types for maximum compatibility
        newTabA.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Active tab clicked');
          setActiveTab('active');
        }, { passive: false });
        
        newTabA.addEventListener('touchstart', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Active tab touched');
          setActiveTab('active');
        }, { passive: false });
        
        newTabA.addEventListener('touchend', (e) => {
          e.preventDefault();
          e.stopPropagation();
        }, { passive: false });
      }
      
      if (tabI) {
        const newTabI = tabI.cloneNode(true);
        tabI.parentNode.replaceChild(newTabI, tabI);
        
        // Add all event types for maximum compatibility
        newTabI.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Completed tab clicked');
          setActiveTab('inactive');
        }, { passive: false });
        
        newTabI.addEventListener('touchstart', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Completed tab touched');
          setActiveTab('inactive');
        }, { passive: false });
        
        newTabI.addEventListener('touchend', (e) => {
          e.preventDefault();
          e.stopPropagation();
        }, { passive: false });
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

  // build UL items with see more functionality
  const asList = (arr, type) => {
    if (!arr.length) return '<li class="empty">None</li>';
    
    const maxDisplay = 3;
    const items = arr.slice(0, maxDisplay).map(x => `<li>${esc(x.item_name)}</li>`).join('');
    
    if (arr.length > maxDisplay) {
      const remaining = arr.length - maxDisplay;
      const seeMoreButton = `<li class="see-more-item">
        <button class="see-more-btn" onclick="window.App.expandList('${type}')">
          +${remaining} more...
        </button>
      </li>`;
      return items + seeMoreButton;
    }
    
    return items;
  };

  const doneUl = document.getElementById('titles-done');
  const todoUl = document.getElementById('titles-todo');
  if (doneUl) doneUl.innerHTML = asList(state.items.inactive, 'completed');
  if (todoUl) todoUl.innerHTML = asList(state.items.active, 'active');
}

// Add expandList function to global App object
window.App = window.App || {};
window.App.expandList = function(type) {
  console.log('Expanding list for:', type);
  
  const isCompleted = type === 'completed';
  const arr = isCompleted ? state.items.inactive : state.items.active;
  const targetUl = document.getElementById(isCompleted ? 'titles-done' : 'titles-todo');
  
  if (!targetUl || !arr.length) return;
  
  // Show all items with a collapse option
  const esc = (s)=>String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[m]));
  const allItems = arr.map(x => `<li>${esc(x.item_name)}</li>`).join('');
  const collapseButton = `<li class="see-more-item">
    <button class="see-more-btn" onclick="window.App.collapseList('${type}')">
      Show less...
    </button>
  </li>`;
  
  targetUl.innerHTML = allItems + collapseButton;
};

window.App.collapseList = function(type) {
  console.log('Collapsing list for:', type);
  renderCounts(); // This will reset to the normal 3-item view
};

// Add some test data for demonstration
window.App.addTestData = function() {
  console.log('Adding test data...');
  
  // Add test active tasks
  state.items.active = [
    { item_id: 1, item_name: 'Complete mobile responsive design', item_description: 'Fix tab switching and add see more functionality', status: 'active' },
    { item_id: 2, item_name: 'Review dark mode implementation', item_description: 'Test dark mode on all devices', status: 'active' },
    { item_id: 3, item_name: 'Add touch optimizations', item_description: 'Improve mobile touch interactions', status: 'active' },
    { item_id: 4, item_name: 'Test cross-browser compatibility', item_description: 'Check Safari, Chrome, Firefox', status: 'active' },
    { item_id: 5, item_name: 'Optimize performance', item_description: 'Reduce bundle size and load time', status: 'active' }
  ];
  
  // Add test completed tasks
  state.items.inactive = [
    { item_id: 6, item_name: 'Set up project structure', item_description: 'Create HTML, CSS, JS files', status: 'inactive' },
    { item_id: 7, item_name: 'Implement basic layout', item_description: 'Add header, sidebar, main content', status: 'inactive' },
    { item_id: 8, item_name: 'Add CSS Grid layout', item_description: 'Responsive grid system', status: 'inactive' },
    { item_id: 9, item_name: 'Create color scheme', item_description: 'Define CSS custom properties', status: 'inactive' }
  ];
  
  renderCounts();
  renderList();
  console.log('Test data added!');
};

// Auto-add test data if no tasks exist
if (state.items.active.length === 0 && state.items.inactive.length === 0) {
  console.log('No tasks found, adding test data...');
  setTimeout(() => window.App.addTestData(), 1000);
}

// Add debug function for mobile testing
window.App.debugTabs = function() {
  console.log('=== TAB DEBUG INFO ===');
  console.log('Current tab:', state.currentTab);
  console.log('Active tasks:', state.items.active.length);
  console.log('Completed tasks:', state.items.inactive.length);
  
  const tabA = document.getElementById('tab-active');
  const tabI = document.getElementById('tab-inactive');
  console.log('Active tab element:', tabA);
  console.log('Active tab has active class:', tabA?.classList.contains('active'));
  console.log('Completed tab element:', tabI);
  console.log('Completed tab has active class:', tabI?.classList.contains('active'));
  
  const listEl = document.getElementById('list');
  console.log('List element children count:', listEl?.children.length);
  
  // Show visual indicator
  const indicator = document.createElement('div');
  indicator.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:green;color:white;padding:20px;z-index:10000;border-radius:8px;font-size:16px;';
  indicator.innerHTML = `
    <div>Current Tab: ${state.currentTab}</div>
    <div>Active: ${state.items.active.length} tasks</div>
    <div>Completed: ${state.items.inactive.length} tasks</div>
    <button onclick="this.parentElement.remove()">Close</button>
  `;
  document.body.appendChild(indicator);
  
  setTimeout(() => {
    if (indicator.parentElement) indicator.remove();
  }, 5000);
};

})();
