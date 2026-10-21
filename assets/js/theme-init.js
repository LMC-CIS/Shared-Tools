// Runs before the page paints so a saved light/dark choice does not flash.
try {
  var t = localStorage.getItem('theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch (e) { /* storage unavailable: follow the system setting */ }
