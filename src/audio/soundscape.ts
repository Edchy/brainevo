import { events } from '../data';
import { world } from '../world/store';
import { getSettings, subscribe } from '../style/store';
import { getBus, isRunning, onAudioChange } from './engine';
import { LAYERS, LAYER_IDS, sharedNoise, type Drive, type Kit, type Layer, type LayerId } from './instruments';
import { chordNow } from './score';

/**
 * The sounds of each scene, under the score: the sea at the first oceans, crickets in the mammals' night, fire, cave
 * drips and a bone flute, neurons firing wherever a brain is the subject. Levels 0..1 per event; an event's sounds
 * fade in over the station before it and out over the one after, so neighbours crossfade (a sound they share holds).
 *
 * The soundscape listens to how you move: travelling fast blurs the world (its sounds sink and darken under the rush
 * of air from the score) and it comes back into focus when you stop. The heart quickens with speed, and neurons fire
 * faster the faster you go and the bigger the brains get.
 */
const SCAPES: Record<string, Partial<Record<LayerId, number>>> = {
  // cosmic and early Earth
  'big-bang': { rumble: 0.5, sparkle: 0.2 },
  'first-stars-heavy-elements': { sparkle: 1 },
  'earth-forms': { rumble: 1, fire: 0.3 },
  'oceans-prebiotic-chemistry': { surf: 0.9, rumble: 0.15 },
  // life under water
  'first-life': { under: 0.8, bubbles: 0.7 },
  'chemical-signalling': { under: 0.7, bubbles: 0.5 },
  'ion-channels': { under: 0.55, bubbles: 0.3, spikes: 0.3 },
  'bacterial-chemotaxis': { under: 0.65, bubbles: 0.55 },
  'eukaryotes': { under: 0.65, bubbles: 0.3 },
  'multicellularity': { under: 0.65, bubbles: 0.35 },
  'sponges-no-neurons': { under: 0.75, bubbles: 0.3 },
  'first-neurons-nerve-net': { under: 0.5, spikes: 0.75 },
  'bilateral-symmetry-ganglia': { under: 0.5, spikes: 0.5 },
  'cephalization': { under: 0.45, spikes: 0.55 },
  'cambrian-explosion-eyes': { under: 0.75, bubbles: 0.35 },
  'chordates-notochord-nerve-cord': { under: 0.65, spikes: 0.25 },
  'first-vertebrates-neural-crest': { under: 0.6, spikes: 0.3 },
  'tripartite-brain': { under: 0.4, spikes: 0.45 },
  'dopamine-reinforcement-signal': { under: 0.35, spikes: 0.8 },
  'basal-ganglia-actor-critic': { under: 0.35, spikes: 0.7 },
  'lampreys-brain-and-cerebellum': { under: 0.65, bubbles: 0.25, spikes: 0.3 },
  'myelin-jawed-fish': { under: 0.45, spikes: 0.8 },
  'pallium-fish-forebrain': { under: 0.55, spikes: 0.4 },
  // onto land
  'tetrapods-move-to-land': { surf: 0.85, wind: 0.3 },
  'amniotes-first-eggs': { wind: 0.5, heart: 0.3 },
  'reptile-brain-plan': { wind: 0.45, spikes: 0.35 },
  'synapsids': { wind: 0.55, rumble: 0.12 },
  'cynodont-endothermy': { wind: 0.35, heart: 0.75 },
  // the mammals' night (katydids were already singing in the Jurassic)
  'nocturnal-bottleneck': { crickets: 0.9, wind: 0.25 },
  'mammalian-middle-ear': { crickets: 0.85, wind: 0.2 },
  'neocortex': { spikes: 0.6, crickets: 0.25 },
  'limbic-hippocampus': { spikes: 0.65 },
  'kpg-mammal-radiation': { rumble: 0.7, wind: 0.5 },
  // primates in the trees
  'first-primates': { birds: 0.85, wind: 0.4 },
  'forward-eyes-visual-cortex': { birds: 0.5, wind: 0.3, spikes: 0.3 },
  'trichromatic-vision': { birds: 0.6, wind: 0.3 },
  'prefrontal-expansion': { spikes: 0.55, birds: 0.2 },
  'social-brain': { birds: 0.55, wind: 0.3 },
  'great-ape-cognition': { birds: 0.45, wind: 0.3 },
  'mirror-self-recognition': { birds: 0.25, spikes: 0.35 },
  'vicarious-trial-and-error-replay': { spikes: 0.75 },
  'agranular-prefrontal-simulation': { spikes: 0.65 },
  'imitation-learning-primates': { birds: 0.45, wind: 0.3, knap: 0.2 },
  'mental-state-inference-primates': { birds: 0.3, spikes: 0.4 },
  // hominins on the savanna
  'sahelanthropus': { wind: 0.7, birds: 0.35 },
  'bipedalism': { wind: 0.7, birds: 0.3 },
  'ardipithecus': { wind: 0.6, birds: 0.4 },
  'laetoli-footprints': { wind: 0.65, rumble: 0.25 },
  'australopithecus-lucy': { wind: 0.55, birds: 0.35 },
  'oldowan-tools': { knap: 0.9, wind: 0.35 },
  'homo-habilis': { wind: 0.45, knap: 0.3 },
  'homo-erectus': { wind: 0.5 },
  'cooperative-breeding': { wind: 0.35, birds: 0.35, fire: 0.1 },
  'acheulean-handaxe': { knap: 0.85, wind: 0.3 },
  'expensive-tissue': { heart: 0.75, spikes: 0.3 },
  'broca-vocal-tract': { voice: 0.6 },
  'control-of-fire': { fire: 0.95, crickets: 0.3 },
  'homo-heidelbergensis': { fire: 0.6, wind: 0.3 },
  'neanderthals': { wind: 0.65, fire: 0.25 },
  'denisovans': { wind: 0.75 },
  'homo-naledi': { drips: 0.75 },
  'teaching-cumulative-culture': { knap: 0.55, fire: 0.35 },
  // our species
  'jebel-irhoud-sapiens': { wind: 0.45, spikes: 0.2 },
  'globular-brain': { spikes: 0.55 },
  'ochre-symbolic-thought': { scratch: 0.55, surf: 0.2 },
  'language-shares-simulations': { voice: 0.65 },
  'language-foxp2': { voice: 0.5, spikes: 0.3 },
  'out-of-africa': { wind: 0.55, surf: 0.35 },
  'cave-art': { drips: 0.85, fire: 0.15 },
  'bone-flutes-music': { flute: 1, drips: 0.45 },
  'burial-ritual': { fire: 0.2, drips: 0.25 },
  'behavioural-modernity': { fire: 0.3, flute: 0.3 },
  'gobekli-tepe': { fire: 0.35, crickets: 0.4, wind: 0.25 },
  'agriculture': { wind: 0.6, birds: 0.5 },
  // history
  'writing': { scratch: 0.7 },
  'alphabet': { scratch: 0.6 },
  'philosophy-of-mind': { wind: 0.3, birds: 0.25 },
  'printing-press': { press: 0.9 },
  'scientific-revolution': { clock: 0.85 },
  'neuron-doctrine': { scratch: 0.45, spikes: 0.4 },
  'eeg': { spikes: 0.65 },
  'fmri': { mri: 0.8 },
  'brain-computer-interfaces': { spikes: 0.5, data: 0.55 },
  'ai-mirror': { data: 0.75, sparkle: 0.25 },
  'machines-learn-language': { data: 0.6, spikes: 0.2 },
  'now': { heart: 0.65 },
  // what comes next
  'minds-and-machines': { data: 0.4, spikes: 0.35 },
  'your-lifetime': { clock: 0.55, heart: 0.3 },
  'sun-brightens': { rumble: 0.3, wind: 0.2 },
  'red-giant': { rumble: 0.75 },
  'last-stars': { sparkle: 0.25 },
  // here and now: silence to imagine in, then a few quiet sounds, a breath, a dawn chorus, a heartbeat
  'coda-before': { sparkle: 0.15 },
  'coda-scale': { sparkle: 0.25 },
  'coda-electricity': { spikes: 0.6 },
  'coda-nobody': { voice: 0.2 },
  'coda-here': { breath: 0.85, heart: 0.2 },
  'coda-morning': { birds: 0.55, wind: 0.2 },
  'coda-heartbeats': { heart: 0.7 },
};

const ROWS = events.map((e) => SCAPES[e.id] ?? {});
const LAST = Math.max(1, events.length - 1);

// hear as they heard: until the mammalian middle ear (three tiny bones, high-pitched hearing), the scene sounds lose
// their top end; it opens as you arrive there. (The score is the film's music, not what the animals hear: untouched.)
const EAR_FROM = events.findIndex((e) => e.id === 'first-life');
const EAR_OPEN = events.findIndex((e) => e.id === 'mammalian-middle-ear');
function hearing(f: number) {
  const ramp = (a: number, b: number) => { const t = Math.max(0, Math.min(1, (f - a) / (b - a))); return t * t * (3 - 2 * t); };
  const dull = ramp(EAR_FROM - 0.8, EAR_FROM - 0.1) * (1 - ramp(EAR_OPEN - 0.75, EAR_OPEN - 0.08));
  return 18000 * Math.pow(4600 / 18000, dull); // log-ease between 18 kHz and 4.6 kHz
}

/** layer levels at a continuous station position (cos² bumps one station wide: neighbours sum to one) */
export function levelsAt(f: number) {
  const out: Partial<Record<LayerId, number>> = {};
  const i0 = Math.floor(f);
  for (const i of [i0, i0 + 1]) {
    if (i < 0 || i >= ROWS.length) continue;
    const w = Math.cos((Math.PI / 2) * Math.min(1, Math.abs(f - i))) ** 2;
    for (const [k, v] of Object.entries(ROWS[i]) as [LayerId, number][]) out[k] = (out[k] ?? 0) + w * v;
  }
  return out;
}

/** viewport widths per second that counts as flying through time */
const FLYING = 1.6;
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

class Soundscape {
  private live = new Map<LayerId, { layer: Layer; quiet: number }>();
  private kit: Kit | null = null;
  private out: GainNode | null = null;
  private blur: BiquadFilterNode | null = null;
  private on = false;
  private speed = 0;

  tick() {
    const bus = getBus();
    if (!bus) return;
    const s = getSettings();
    const want = isRunning() && s.sound && s.ambience;
    const ctx = bus.ctx, now = ctx.currentTime;
    if (!this.kit || !this.out || !this.blur) {
      this.out = ctx.createGain();
      this.out.gain.value = 0;
      this.blur = ctx.createBiquadFilter();
      this.blur.type = 'lowpass'; this.blur.frequency.value = 18000; this.blur.Q.value = 0.5;
      this.out.connect(this.blur).connect(bus.amb);
      this.kit = { ctx, out: this.out, wet: bus.reverb, noise: sharedNoise(ctx) };
    }
    if (want !== this.on) {
      this.on = want;
      if (!want) {
        this.out.gain.setTargetAtTime(0, now, 0.3);
        for (const e of this.live.values()) e.layer.stop(now + 1);
        this.live.clear();
      }
    }
    if (!this.on) return;

    const v = world.velocity;
    this.speed += (Math.min(1, Math.abs(v) / FLYING) - this.speed) * 0.35;
    // travelling fast blurs the world: its sounds sink and darken, and come back into focus when you stop
    const focus = 1 - smooth(0.1, 0.85, this.speed);
    this.blur.frequency.setTargetAtTime(Math.min(hearing(world.stationF), 600 + focus * focus * 17400), now, 0.12);
    this.out.gain.setTargetAtTime(0.25 + 0.75 * focus, now, 0.15);

    const f = world.stationF;
    const lv = levelsAt(f);
    const d: Drive = { speed: this.speed, age: Math.max(0, Math.min(1, f / LAST)), chord: chordNow() };
    const until = now + (document.hidden ? 1.2 : 0.3); // background tabs run timers about once a second
    for (const id of LAYER_IDS) {
      const l = lv[id] ?? 0;
      let e = this.live.get(id);
      if (!e) {
        // new sounds wait until you slow down (no point building a scene you are flying past)
        if (l < 0.02 || this.speed > 0.6) continue;
        e = { layer: new LAYERS[id](this.kit), quiet: -1 };
        this.live.set(id, e);
      }
      e.layer.update(now, until, l, d);
      if (l > 0.004) e.quiet = -1;
      else if (e.quiet < 0) e.quiet = now;
      else if (now - e.quiet > 3) { e.layer.stop(now); this.live.delete(id); }
    }
  }

  /** dev: which layers are alive and at what level */
  status() {
    const lv = levelsAt(world.stationF);
    return { speed: +this.speed.toFixed(2), live: [...this.live.keys()].map((k) => `${k} ${(lv[k] ?? 0).toFixed(2)}`) };
  }
}

const scape = new Soundscape();
if (typeof window !== 'undefined') {
  setInterval(() => scape.tick(), 100);
  const kick = () => scape.tick();
  subscribe(kick);
  onAudioChange(kick);
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__scape = () => scape.status();
    void import('./dev'); // __scapeTest / __scapeSheet: offline renders and spectrograms
  }
}
