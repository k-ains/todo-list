// auth.js — sign in / sign up via Worker proxy
(function(){
  const { $, toast, apiGet, apiSend, saveSession } = window.App;

  function switchTab(which){
    const s = document.getElementById('form-signin');
    const u = document.getElementById('form-signup');
    if (which === 'up') {
      s.style.display = 'none';  
      u.style.display = 'grid';
      document.getElementById('tab-signup').classList.add('active');
      document.getElementById('tab-signin').classList.remove('active');
    } else {
      u.style.display = 'none';  
      s.style.display = 'grid';
      document.getElementById('tab-signin').classList.add('active');
      document.getElementById('tab-signup').classList.remove('active');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Set default state to show signin form
    switchTab('in');
    
    document.getElementById('tab-signin')?.addEventListener('click', ()=>switchTab('in'));
    document.getElementById('tab-signup')?.addEventListener('click', ()=>switchTab('up'));

    // SIGN IN (GET with query params)
    document.getElementById('form-signin')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = e.target.email.value.trim();
      const password = e.target.password.value.trim();
      try {
        const res = await apiGet('/signin_action.php', { email, password });
        if (res.status !== 200) throw new Error(res.message || 'Sign in failed');
        saveSession(res.data);
        location.href = 'app.html';
      } catch(err){ toast(err.message || 'Failed to sign in', 'error'); }
    });

    // SIGN UP (POST JSON)
    document.getElementById('form-signup')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const first_name = e.target.first_name.value.trim();
      const last_name = e.target.last_name.value.trim();
      const email = e.target.email.value.trim();
      const password = e.target.password.value.trim();
      const confirm_password = e.target.confirm_password.value.trim();
      try {
        const res = await apiSend('POST', '/signup_action.php', {
          first_name, last_name, email, password, confirm_password
        }); // JSON body
        if (res.status !== 200) throw new Error(res.message || 'Sign up failed');
        toast('Account created. You can sign in now.');
        switchTab('in');
      } catch(err){ toast(err.message || 'Failed to sign up', 'error'); }
    });
  });
})();
