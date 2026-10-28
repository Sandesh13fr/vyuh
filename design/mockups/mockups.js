// Shared mockup behaviour: theme toggle and ring meters. No dependencies.
(function () {
  var root = document.documentElement, KEY = 'vyuh-theme';
  function apply(t) { if (t === 'light' || t === 'dark') root.dataset.theme = t; }
  try { apply(localStorage.getItem(KEY)); } catch (e) {}
  apply(new URLSearchParams(location.search).get('theme')); // ?theme=light|dark for reviews and phone frames
  // keep phone-frame iframes and other tabs in step
  addEventListener('storage', function (e) { if (e.key === KEY) apply(e.newValue); });

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-theme-toggle]');
    if (!b) return;
    var dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem(KEY, root.dataset.theme); } catch (e) {}
    document.querySelectorAll('iframe').forEach(function (f) {
      try { f.contentDocument.documentElement.dataset.theme = root.dataset.theme; } catch (e) {}
    });
  });

  // <span class="meter" data-r="2"> : rings before 2 held, ring 2 blocked, rest not reached.
  // data-r="0" means all seven held; data-r="" means no intent reached the rings.
  window.vyMeter = function (el) {
    var r = el.getAttribute('data-r'), n = r === '' ? -1 : +r, html = '';
    for (var i = 1; i <= 7; i++) {
      var c = n === 0 || (n > 0 && i < n) ? 'h' : i === n ? 'b' : '';
      html += '<span class="' + c + '"></span>';
    }
    el.innerHTML = html;
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', n === 0 ? 'All seven rings held' : n > 0 ? 'Stopped at ring ' + n : 'No intent reached the rings');
  };
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.meter[data-r]').forEach(window.vyMeter);
  });
})();
