(function () {
  var LIGHT = {
    '--color-bg': '#f3f2f2', '--color-surface': '#eae9e9', '--color-text': '#201f1d',
    '--color-accent': '#b68235', '--color-divider': 'rgba(32,31,29,.15)',
    '--color-accent-100': '#fff3e4', '--color-accent-700': '#7d5411',
    '--color-neutral-100': '#f8f4f4', '--color-neutral-200': '#eae7e7', '--color-neutral-800': '#444141',
    '--ll-raised': '#faf9f8', '--ll-muted': '#5f5b58', '--ll-faint': '#86817d',
    '--ll-line': 'rgba(32,31,29,.15)', '--ll-line-soft': 'rgba(32,31,29,.08)', '--ll-hover': 'rgba(32,31,29,.045)',
    '--ll-accent-ink': '#7d5411', '--ll-accent-tint': 'rgba(182,130,53,.11)',
    '--ll-in': '#2f6a4c', '--ll-out': '#a3412e', '--ll-move': '#47607e', '--ll-warn': '#a65a12',
    '--ll-in-tint': 'rgba(47,106,76,.09)', '--ll-out-tint': 'rgba(163,65,46,.08)', '--ll-move-tint': 'rgba(71,96,126,.09)', '--ll-warn-tint': 'rgba(166,90,18,.09)',
    '--ll-backdrop': 'rgba(32,31,29,.42)', '--ll-on-solid': '#ffffff', '--ll-bar': 'rgba(32,31,29,.13)'
  };
  var DARK = {
    '--color-bg': '#191816', '--color-surface': '#23211f', '--color-text': '#ebe7e1',
    '--color-accent': '#d2a15a', '--color-divider': 'rgba(235,231,225,.14)',
    '--color-accent-100': '#3a2c18', '--color-accent-700': '#e6c08a',
    '--color-neutral-100': '#262422', '--color-neutral-200': '#2e2c29', '--color-neutral-800': '#d8d3cc',
    '--ll-raised': '#23211f', '--ll-muted': '#aaa49d', '--ll-faint': '#857f78',
    '--ll-line': 'rgba(235,231,225,.14)', '--ll-line-soft': 'rgba(235,231,225,.07)', '--ll-hover': 'rgba(235,231,225,.05)',
    '--ll-accent-ink': '#e6c08a', '--ll-accent-tint': 'rgba(210,161,90,.13)',
    '--ll-in': '#7fb896', '--ll-out': '#e48c78', '--ll-move': '#9db1cc', '--ll-warn': '#e3a463',
    '--ll-in-tint': 'rgba(127,184,150,.12)', '--ll-out-tint': 'rgba(228,140,120,.11)', '--ll-move-tint': 'rgba(157,177,204,.12)', '--ll-warn-tint': 'rgba(227,164,99,.12)',
    '--ll-backdrop': 'rgba(0,0,0,.6)', '--ll-on-solid': '#191816', '--ll-bar': 'rgba(235,231,225,.16)'
  };
  var FONTS = {
    serif: { '--font-heading': '"Cormorant Garamond","Noto Serif KR",serif', '--font-body': '"Lora","Noto Serif KR",serif' },
    sans: { '--font-heading': '"Cormorant Garamond","Pretendard",sans-serif', '--font-body': '"Pretendard",sans-serif' },
    mixed: { '--font-heading': '"Cormorant Garamond","Noto Serif KR",serif', '--font-body': '"Pretendard Variable","Pretendard",system-ui,sans-serif' }
  };
  function apply(dark, font) {
    var r = document.documentElement, m = dark ? DARK : LIGHT, f = FONTS[font] || FONTS.serif, k;
    for (k in m) r.style.setProperty(k, m[k]);
    for (k in f) r.style.setProperty(k, f[k]);
    r.style.colorScheme = dark ? 'dark' : 'light';
  }
  function applyTo(el, dark) { var m = dark ? DARK : LIGHT, k; for (k in m) el.style.setProperty(k, m[k]); el.style.colorScheme = dark ? 'dark' : 'light'; }
  var cs = document.currentScript, def = (cs && cs.getAttribute('data-font')) || 'serif';
  window.LLTheme = { apply: apply, applyTo: applyTo, font: def };
  apply(false, def);
})();
