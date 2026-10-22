export type Era =
  | 'cosmic'      // Big Bang -> early Earth
  | 'origin'      // first life, single cells
  | 'nerves'      // first neurons, nerve nets, ganglia
  | 'vertebrate'  // fish, amphibians, reptiles: the basic brain plan
  | 'mammal'      // neocortex, warm-blooded, limbic system
  | 'primate'     // visual cortex, large frontal lobes, social brains
  | 'hominin'     // bipedalism, tools, fire, brain expansion
  | 'sapiens'     // language, art, symbolic thought
  | 'modern'      // agriculture, writing, science, neuroscience
  | 'future'      // what comes next: sketched where it is up to us, painted where physics decides
  | 'after';      // the closing reflection: here and now

/** Narrative spine, after Max Bennett, "A Brief History of Intelligence" (2023). */
export type Breakthrough =
  | 'steering'     // 1: the first bilaterians, valence-based navigation (>550 Mya)
  | 'reinforcing'  // 2: the first vertebrates, reinforcement learning (~520 Mya)
  | 'simulating'   // 3: the first mammals, neocortex, world model (>200 Mya)
  | 'mentalizing'  // 4: the first primates, modelling minds (~60 Mya)
  | 'speaking';    // 5: the first humans (genus Homo), language

export interface TimelineEvent {
  /** Which of the five breakthroughs this event belongs to; absent for pre-brain events */
  breakthrough?: Breakthrough;
  id: string;                 // kebab-case, unique
  /** Years before present. Positive = past, 0 = now, negative = the future. Used for ordering/positioning. */
  yearsAgo: number;
  /** Human-readable label, e.g. "3.8 billion years ago" */
  yearLabel: string;
  era: Era;
  title: string;
  /**
   * What happened, in two or three sentences: shown under the headline and read aloud as the narration, word for word.
   * Written for the ear. When it opens with its own date ("Around 600 million years ago, ..."), that clause is set as
   * the caption's date; otherwise `yearLabel` leads in front of it.
   */
  summary: string;
  /** 2-4 sentences, what it meant for the brain/nervous system */
  brainSignificance: string;
  /** Optional extra detail paragraph */
  details?: string;
  /** Brain size indicator in cm^3 where meaningful (hominins etc.) */
  brainVolumeCc?: number;
  /** Placeholder visual. Real art goes to /public/media/<id>.svg|webp later */
  image?: { src: string; alt: string; credit?: string };
  /** Key-term chips */
  tags?: string[];
  /** Where the claims come from: checked references, shown under "Sources" in the expanded view */
  sources?: Source[];
  /** 'coda': a closing reflection, set as one centred line with no headline or date (the "after" chapter) */
  kind?: 'coda';
  /** something the station does beyond its text: the weeks of a life, a held breath, the visitor's heartbeats */
  extra?: 'weeks' | 'imagine' | 'breath' | 'heartbeats';
}

export interface Source {
  /** short human label, e.g. "Planck Collaboration (2020), Astronomy & Astrophysics" */
  label: string;
  url: string;
}
