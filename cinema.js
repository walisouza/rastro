// Cena do painel com Theatre.js: entrada "de câmera" ao abrir a página e fundo vivo (degradê suave em loop).
// As linhas do tempo são escritas à mão (sem o Studio). Se algo falhar, o painel funciona normal, só sem o efeito.
import { getProject } from './vendor/theatre.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
// easing de saída suave: cubic-bezier(.16, 1, .3, 1)
const kf = (id, position, value) => ({ id, position, connectedRight: true, handles: [0.3, 1, 0.16, 1], type: 'bezier', value });
let uid = 0;
function sequence(length, objects) {
  const tracksByObject = {};
  for (const [obj, props] of Object.entries(objects)) {
    const trackData = {}, trackIdByPropPath = {};
    for (const [prop, pts] of Object.entries(props)) {
      const id = 't' + uid++;
      trackData[id] = { type: 'BasicKeyframedTrack', __debugName: `${obj}:["${prop}"]`, keyframes: pts.map(([p, v]) => kf('k' + uid++, p, v)) };
      trackIdByPropPath[`["${prop}"]`] = id;
    }
    tracksByObject[obj] = { trackData, trackIdByPropPath };
  }
  return { staticOverrides: { byObject: {} }, sequence: { subUnitsPerUnit: 30, length, type: 'PositionalSequence', tracksByObject } };
}

const state = {
  definitionVersion: '0.4.0', revisionHistory: [],
  sheetsById: {
    Entrada: sequence(1.6, {
      Palco: { blur: [[0, 9], [0.9, 0]], scale: [[0, 0.968], [1.2, 1]], rotX: [[0, 5], [1.2, 0]], y: [[0, 22], [1.2, 0]], opacity: [[0, 0.2], [0.7, 1]] },
      Luz: { glow: [[0, 0], [0.55, 1], [1.6, 0.4]] },
    }),
    Fundo: sequence(14, {
      Aurora: {
        ax: [[0, 16], [7, 30], [14, 16]], ay: [[0, 8], [7, 20], [14, 8]],
        bx: [[0, 88], [7, 72], [14, 88]], by: [[0, 92], [7, 78], [14, 92]],
        cx: [[0, 62], [7, 44], [14, 62]], cy: [[0, 34], [7, 52], [14, 34]],
        i: [[0, 1], [7, 0.7], [14, 1]],
      },
    }),
  },
};

const project = getProject('Rastro', { state });
const entrada = project.sheet('Entrada'), fundo = project.sheet('Fundo');
const palco = entrada.object('Palco', { blur: 0, scale: 1, rotX: 0, y: 0, opacity: 1 });
const luz = entrada.object('Luz', { glow: 0.4 });
const aurora = fundo.object('Aurora', { ax: 16, ay: 8, bx: 88, by: 92, cx: 62, cy: 34, i: 1 });

const bg = document.getElementById('scene');
let target = null;

palco.onValuesChange((v) => {
  if (!target) return;
  const done = v.blur < 0.05 && Math.abs(v.scale - 1) < 0.0005 && v.y < 0.05;
  if (done) { target.style.transform = ''; target.style.filter = ''; target.style.opacity = ''; target = null; return; }
  target.style.transform = `perspective(1400px) translateY(${v.y.toFixed(2)}px) rotateX(${v.rotX.toFixed(2)}deg) scale(${v.scale.toFixed(4)})`;
  target.style.filter = v.blur > 0.05 ? `blur(${v.blur.toFixed(2)}px)` : '';
  target.style.opacity = v.opacity.toFixed(3);
});
luz.onValuesChange((v) => { bg?.style.setProperty('--glow', v.glow.toFixed(3)); });
aurora.onValuesChange((v) => {
  if (!bg) return;
  for (const k of ['ax', 'ay', 'bx', 'by', 'cx', 'cy']) bg.style.setProperty('--' + k, v[k].toFixed(2) + '%');
  bg.style.setProperty('--ai', v.i.toFixed(3));
});

let first = true;
// chamada quando uma página nova termina de montar (não nas trocas de filtro ao vivo)
export function enter(el) {
  if (reduce || !el) return;
  target = el;
  entrada.sequence.position = 0;
  entrada.sequence.play({ rate: first ? 1 : 1.7 });
  first = false;
}

project.ready.then(() => { if (!reduce) fundo.sequence.play({ iterationCount: Infinity }); });
