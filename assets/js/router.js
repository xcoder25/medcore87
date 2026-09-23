/* ============================================================
   HOSPITAL OS — HASH ROUTER
   Client-side SPA routing without a framework
   ============================================================ */
window.Router = (() => {
  const routes = {};
  let currentPage = null;
  let currentParams = {};

  function register(pattern, handler) {
    routes[pattern] = handler;
  }

  function parseHash(hash) {
    const path = hash.replace('#', '').replace(/^\//, '');
    const parts = path.split('/');
    return parts;
  }

  function match(hash) {
    const parts = parseHash(hash || window.location.hash);
    // Try exact match first
    const path = parts.join('/');

    // Check registered patterns
    for (const [pattern, handler] of Object.entries(routes)) {
      const pParts = pattern.replace(/^\//, '').split('/');
      if (pParts.length !== parts.length) continue;
      const params = {};
      let matched = true;
      for (let i = 0; i < pParts.length; i++) {
        if (pParts[i].startsWith(':')) {
          params[pParts[i].slice(1)] = parts[i];
        } else if (pParts[i] !== parts[i]) {
          matched = false;
          break;
        }
      }
      if (matched) return { handler, params };
    }
    return null;
  }

  function navigate(path) {
    window.location.hash = path.startsWith('#') ? path : '#' + path;
  }

  function handleChange() {
    const hash = window.location.hash || '#/dashboard';
    const result = match(hash);

    // Highlight active nav item
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.remove('active');
    });

    const page = parseHash(hash)[0] || 'dashboard';
    const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navEl) navEl.classList.add('active');

    // Render page
    const root = document.getElementById('page-root');
    if (!root) return;

    if (result) {
      currentParams = result.params;
      currentPage = page;
      root.innerHTML = '';
      result.handler(result.params);
    } else {
      // Default to dashboard
      const dashMatch = match('#/dashboard');
      if (dashMatch) dashMatch.handler({});
    }
  }

  function init() {
    window.addEventListener('hashchange', handleChange);
    handleChange(); // initial load
  }

  function getParams() { return currentParams; }
  function getCurrentPage() { return currentPage; }

  return { register, navigate, init, getParams, getCurrentPage };
})();
