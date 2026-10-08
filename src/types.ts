export type Era =
  | 'cosmic'      // Big Bang -> early Earth
  | 'origin'      // first life, single cells
  | 'nerves'      // first neurons, nerve nets, ganglia
  | 'vertebrate'  // fish, amphibians, reptiles: the basic brain plan
  | 'mammal'      // neocortex, warm-blooded, limbic system
  | 'primate'     // visual cortex, large frontal lobes, social brains
  | 'hominin'     // bipedalism, tools, fire, brain expansion
  | 'sapiens'     // language, art, symbolic thought
  | 'modern';     // agriculture, writing, science, neuroscience

/** Narrative spine, after Max Bennett, "A Brief History of Intelligence" (2023). */
export type Breakthrough =
  | 'steering'     // 1: bilaterians, valence-based navigation (~550 Mya)
  | 'reinforcing'  // 2: vertebrates, reinforcement learning (~500 Mya)
  | 'simulating'   // 3: mammals, neocortex, world model (~100 Mya)
  | 'mentalizing'  // 4: primates, theory of mind (~30 Mya)
  | 'speaking';    // 5: humans, language (~100 kya)

export interface TimelineEvent {
  /** Which of the five breakthroughs this event belongs to; absent for pre-brain events */
  breakthrough?: Breakthrough;
  id: string;                 // kebab-case, unique
  /** Years before present. Positive = past. 0 = now. Used for ordering/positioning. */
  yearsAgo: number;
  /** Human-readable label, e.g. "3.8 billion years ago" */
  yearLabel: string;
  era: Era;
  title: string;
  /** 1-2 sentences, the headline of what happened */
  summary: string;
  /** 2-4 sentences, what it meant for the brain/nervous system */
  brainSignificance: string;
  /** Optional extra detail paragraph */
  details?: string;
  /** Brain size indicator in cm^3 where meaningful (hominins etc.) */
  brainVolumeCc?: number;
  /** Placeholder visual. Real art goes to /public/media/<id>.svg|webp later */
  image?: { src: string; alt: string; credit?: string };
  /** Placeholder audio narration. Real files go to /public/media/<id>.mp3 later */
  audio?: { src: string; transcript?: string };
  /** Key-term chips */
  tags?: string[];
}
