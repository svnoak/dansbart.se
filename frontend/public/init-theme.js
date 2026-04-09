(function() {
  try {
    var t = localStorage.getItem('dansbart-theme');
    if (t === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
