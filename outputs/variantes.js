// Review controls only. All four compositions are static.
const variants = [
  { name: 'Signature', note: 'Centrée. Le séparateur relie le nom et le symbole.', type: 'signature' },
  { name: 'Duo', note: 'Plus ample. Le nom et les carrés se répondent directement.', type: 'duo' },
  { name: 'Monument', note: 'Le symbole prend de l’espace. Le nom reste en retrait.', type: 'monument' },
  { name: 'Décalage', note: 'Deux points dans l’espace. Une composition plus libre.', type: 'decalage' },
];
let theme = new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light';
const palettes = {
  orange: {
    label: 'orange & ambre',
    stops: ['#ff6238', '#f58a2b', '#e9ac42'],
  },
  'rose-orange': {
    label: 'rose & orange',
    stops: ['#ed397c', '#fa6463', '#ff9a32'],
  },
};
let palette = new URLSearchParams(window.location.search).get('palette') === 'orange' ? 'orange' : 'rose-orange';
let instance = 0;
const image = (filter = '') => `<image href="assets/logo-mailys-original.png" width="2080" height="640" ${filter ? `filter="url(#${filter})"` : ''}/>`;

function artwork(type) {
  const id = `logo-${++instance}`;
  const ink = theme === 'light' ? '.067' : '.96';
  const separator = theme === 'light' ? '#111111' : '#f5f5f5';
  const colors = palettes[palette];
  const word = (x, y, width) => `<svg x="${x}" y="${y}" width="${width}" height="${width * 284 / 761}" viewBox="785 191 761 284">${image(`${id}-white`)}</svg>`;
  const mark = (x, y, width) => `<svg x="${x}" y="${y}" width="${width}" height="${width}" viewBox="157 125 387 387"><rect x="160" y="128" width="240" height="240" fill="#fff" stroke="#000" stroke-width="6"/><rect x="304" y="272" width="240" height="240" fill="url(#${id}-orange)"/></svg>`;
  let composition;
  if (type === 'signature') {
    composition = `<svg x="360" y="283" width="480" height="133.45" viewBox="0 0 1392 387">${word(0, 65, 761)}<path d="M883 15V372" stroke="${separator}" stroke-opacity=".28" stroke-width="3"/>${mark(1005, 0, 387)}</svg>`;
  } else if (type === 'duo') {
    composition = `${word(290, 278, 425)}${mark(785, 277, 157)}`;
  } else if (type === 'monument') {
    composition = `${word(136, 310, 334)}${mark(635, 137, 426)}`;
  } else {
    composition = `${word(135, 465, 310)}${mark(805, 130, 215)}`;
  }
  return `<svg class="art" viewBox="0 0 1200 700" role="img" aria-labelledby="${id}-title">
    <title id="${id}-title">Maïlys Solutions — ${variants.find(v => v.type === type).name}</title>
    <defs>
      <filter id="${id}-white" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 ${ink}  0 0 0 0 ${ink}  0 0 0 0 ${ink}  0 0 0 1 0"/></filter>
      <linearGradient id="${id}-orange" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors.stops[0]}"/><stop offset=".55" stop-color="${colors.stops[1]}"/><stop offset="1" stop-color="${colors.stops[2]}"/></linearGradient>
    </defs>
    <rect class="art-background" width="1200" height="700"/>
    ${composition}
  </svg>`;
}

const studies = document.querySelector('#studies');
const dialog = document.querySelector('.viewer');
const choices = document.querySelector('.choices');
let selected = 0;

variants.forEach((variant, index) => {
  const number = String(index + 1).padStart(2, '0');
  const study = document.createElement('article');
  study.className = 'study';
  study.innerHTML = `<button type="button" class="study-open" aria-label="Agrandir ${number} — ${variant.name}">${artwork(variant.type)}</button><div class="study-info"><span class="study-number">${number}</span><div><h2>${variant.name}</h2><p>${variant.note}</p></div></div>`;
  study.querySelector('button').addEventListener('click', () => {
    show(index);
    dialog.showModal();
  });
  studies.append(study);
  const choice = document.createElement('button');
  choice.type = 'button';
  choice.textContent = number;
  choice.setAttribute('aria-label', `${number} — ${variant.name}`);
  choice.addEventListener('click', () => show(index));
  choices.append(choice);
});

function show(index) {
  selected = (index + variants.length) % variants.length;
  const variant = variants[selected];
  document.querySelector('#viewer-art').innerHTML = artwork(variant.type);
  document.querySelector('#viewer-title').textContent = `${String(selected + 1).padStart(2, '0')} / ${variant.name}`;
  document.querySelector('#viewer-note').textContent = variant.note;
  [...choices.children].forEach((button, i) => button.setAttribute('aria-pressed', String(i === selected)));
}

document.querySelector('.close').addEventListener('click', () => dialog.close());
dialog.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight') { event.preventDefault(); show(selected + 1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); show(selected - 1); }
  if (/^[1-4]$/.test(event.key)) show(Number(event.key) - 1);
});

function setTheme(nextTheme) {
  theme = nextTheme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.palette = palette;
  document.querySelector('meta[name="theme-color"]').content = theme === 'light' ? '#f0eeeb' : '#080809';
  document.querySelectorAll('[data-theme-choice]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
  });
  document.querySelectorAll('[data-palette-choice]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.paletteChoice === palette));
  });
  document.querySelectorAll('.study-open').forEach((button, index) => {
    button.innerHTML = artwork(variants[index].type);
  });
  document.querySelector('#theme-note').textContent = (theme === 'light'
    ? 'Fond clair · lettrage noir · '
    : 'Fond noir · lettrage blanc · ') + palettes[palette].label;
  if (dialog.open) show(selected);
}

document.querySelectorAll('[data-theme-choice]').forEach(button => {
  button.addEventListener('click', () => {
    setTheme(button.dataset.themeChoice);
    const url = new URL(window.location.href);
    url.searchParams.set('theme', theme);
    window.history.replaceState(null, '', url);
  });
});
document.querySelectorAll('[data-palette-choice]').forEach(button => {
  button.addEventListener('click', () => {
    palette = button.dataset.paletteChoice;
    setTheme(theme);
    const url = new URL(window.location.href);
    url.searchParams.set('palette', palette);
    window.history.replaceState(null, '', url);
  });
});
setTheme(theme);
