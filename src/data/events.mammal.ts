import type { TimelineEvent } from '../types';

export const mammalPrimateEvents: TimelineEvent[] = [
  {
    breakthrough: "reinforcing",
    id: 'synapsids',
    yearsAgo: 315_000_000,
    yearLabel: "about 315 million years ago",
    era: 'vertebrate',
    title: "Synapsids: Our Branch Splits Off",
    summary:
      "Amniotes divide into two great lineages. The synapsids, with a single opening in the skull behind each eye, begin the line that leads to mammals; the sauropsids lead to reptiles and birds.",
    brainSignificance:
      'Early synapsids such as Dimetrodon had small, reptile-like brains dominated by olfactory and midbrain structures. Yet this lineage carried the raw material, a dorsal pallium, that would later be rebuilt into the neocortex.',
    details:
      'Synapsid skull openings anchored larger jaw muscles, an early step toward the powerful chewing and sensory-rich head of mammals.',
    image: { src: `/media/synapsids.svg`, alt: 'Dimetrodon-like synapsid with a sail on its back' },
    audio: {
      src: `/media/synapsids.mp3`,
      transcript:
        "This is the start of our own branch of the tree. Around 315 million years ago, the synapsids split from the line that would lead to reptiles and birds. Their brains were still small, but they held the pallium tissue that would one day become the neocortex.",
    },
    tags: ['synapsid', 'amniote', 'pallium'],
    sources: [
      { label: "Benton & Donoghue (2007). Paleontological evidence to date the tree of life. Molecular Biology and Evolution", url: "https://doi.org/10.1093/molbev/msl150" },
    ],
  },
  {
    breakthrough: "reinforcing",
    id: 'cynodont-endothermy',
    yearsAgo: 250_000_000,
    yearLabel: 'about 250 million years ago',
    era: 'mammal',
    title: 'Cynodonts and the Road to Warm-bloodedness',
    summary:
      'Cynodonts, advanced therapsids, evolve a secondary palate, differentiated teeth, and signs of higher metabolism such as probable fur and respiratory turbinates.',
    brainSignificance:
      'Brain tissue is very energy-hungry, and sustained body heat made it more affordable. A steady internal temperature allowed fast, reliable neural signaling, activity at night, and long-term investment in brain growth.',
    details:
      "Endothermy was likely acquired gradually and is not tied to one fossil. A 2022 study of fossil inner ears suggests that a fully warm-blooded body arose only around 233 million years ago, in the cynodonts closest to mammals.",
    image: { src: `/media/cynodont-endothermy.svg`, alt: 'Small furry cynodont foraging at dusk' },
    audio: {
      src: `/media/cynodont-endothermy.mp3`,
      transcript:
        'Cynodonts were among the first synapsids to look and act a bit like mammals. As their bodies learned to stay warm, their nervous systems could work faster and for longer. Energy-hungry brains finally had a steady power supply.',
    },
    tags: ['endothermy', 'cynodont', 'metabolism'],
    sources: [
      { label: "Araújo et al. (2022). Inner ear biomechanics reveals a Late Triassic origin for mammalian endothermy. Nature", url: "https://doi.org/10.1038/s41586-022-04963-z" },
    ],
  },
  {
    breakthrough: 'simulating',
    id: 'nocturnal-bottleneck',
    yearsAgo: 210_000_000,
    yearLabel: 'about 210 million years ago',
    era: 'mammal',
    title: 'Early Mammals Take the Night Shift',
    summary:
      'Tiny shrew-like mammaliaforms such as Morganucodon live in the shadow of dinosaurs, feeding on insects mostly at night.',
    brainSignificance:
      'Nocturnal life favored smell, hearing, and touch over vision. Olfactory bulbs and odor-processing areas grew, and whiskers fed an expanding somatosensory map. The "nocturnal bottleneck" hypothesis proposes that this reshaped mammalian senses.',
    details:
      'Skull casts of Morganucodon and Hadrocodium show enlarged olfactory regions and brains that were large for body size compared with earlier synapsids.',
    image: { src: `/media/nocturnal-bottleneck.svg`, alt: 'Small nocturnal mammaliaform sniffing in the undergrowth' },
    audio: {
      src: `/media/nocturnal-bottleneck.mp3`,
      transcript:
        'Imagine a creature the size of a shrew, hiding from dinosaurs by day. At night it hunts by smell, sound, and whiskers. Those senses expanded the brain regions that would become the heart of the mammalian mind.',
    },
    tags: ['nocturnal', 'olfaction', 'vibrissae', 'Morganucodon'],
    sources: [
      { label: "Rowe, Macrini & Luo (2011). Fossil evidence on origin of the mammalian brain. Science", url: "https://doi.org/10.1126/science.1203117" },
      { label: "Gerkema et al. (2013). The nocturnal bottleneck and the evolution of activity patterns in mammals. Proceedings of the Royal Society B", url: "https://doi.org/10.1098/rspb.2013.0508" },
    ],
  },
  {
    breakthrough: 'simulating',
    id: 'mammalian-middle-ear',
    yearsAgo: 190_000_000,
    yearLabel: "~200 to 125 million years ago (in stages)",
    era: 'mammal',
    title: 'Three Tiny Bones Sharpen Hearing',
    summary:
      'Jaw bones migrate into the skull and become the malleus and incus, joining the stapes to form the three-bone mammalian middle ear.',
    brainSignificance:
      'This ear transmits high-frequency sound far better than the reptilian design and allows a longer cochlea. Auditory brainstem and cortical circuits for locating and identifying sounds grew to match, giving a night hunter a detailed acoustic map.',
    details:
      'Fossils show the transition in stages, and a detached middle ear evolved independently in more than one mammal lineage. Embryos still echo it: the bones start out attached to the jaw.',
    image: { src: `/media/mammalian-middle-ear.svg`, alt: 'Diagram of jaw bones becoming middle ear bones' },
    audio: {
      src: `/media/mammalian-middle-ear.mp3`,
      transcript:
        'Three tiny bones in your middle ear began as part of the jaw. Their move into the skull made hearing sharper, especially for high-pitched sounds. The brain gained a richer acoustic world to analyze.',
    },
    tags: ['hearing', 'middle ear', 'cochlea'],
    sources: [
      { label: "Meng, Wang & Li (2011). Transitional mammalian middle ear from a new Cretaceous Jehol eutriconodont. Nature", url: "https://doi.org/10.1038/nature09921" },
    ],
  },
  {
    breakthrough: 'simulating',
    id: 'neocortex',
    yearsAgo: 200_000_000,
    yearLabel: 'about 200 million years ago',
    era: 'mammal',
    title: 'The Six-Layered Neocortex Appears',
    summary:
      'The mammalian lineage elaborates the dorsal pallium into a layered neocortex, a sheet of neurons found only in mammals.',
    brainSignificance:
      'The six-layer cortex receives sensory input, sends commands, and links areas through repeating microcircuits. Because the same basic circuit can be copied and modified, enlarging the sheet created new capabilities without redesigning the brain.',
    details:
      'Birds and reptiles have comparable pallial circuits, but not the same layered arrangement. The neocortex later grew enormously in primates and underlies perception, planning, and language in humans.',
    image: { src: `/media/neocortex.svg`, alt: 'Cross-section of cortex showing six layers' },
    audio: {
      src: `/media/neocortex.mp3`,
      transcript:
        'Only mammals have a neocortex, a thin sheet of neurons stacked in six layers. The same circuit pattern repeats across the sheet. Make the sheet bigger and you get new abilities, which is exactly what happened later.',
    },
    tags: ['neocortex', 'cortical layers', 'pallium'],
    sources: [
      { label: "Rowe, Macrini & Luo (2011). Fossil evidence on origin of the mammalian brain. Science", url: "https://doi.org/10.1126/science.1203117" },
      { label: "Stacho et al. (2020). A cortex-like canonical circuit in the avian forebrain. Science", url: "https://doi.org/10.1126/science.abc5534" },
    ],
  },
  {
    breakthrough: 'simulating',
    id: 'limbic-hippocampus',
    yearsAgo: 180_000_000,
    yearLabel: "about 180 million years ago (inferred)",
    era: 'mammal',
    title: 'Limbic System and Hippocampus Take Shape',
    summary:
      'The medial pallium and associated structures become a distinct mammalian limbic system, including a prominent hippocampus, amygdala, and cingulate cortex.',
    brainSignificance:
      'The hippocampus supports spatial maps and the formation of episodic memories, and limbic circuits tie them to emotion and motivation. Together they support parental care, play, and flexible learning, hallmarks of mammalian life.',
    details:
      'The hippocampus itself is far older: reptiles have a homologous medial cortex. What is new in mammals is the elaboration of memory and emotional circuits and their tight link to the neocortex.',
    image: { src: `/media/limbic-hippocampus.svg`, alt: 'Brain with hippocampus and amygdala highlighted' },
    audio: {
      src: `/media/limbic-hippocampus.mp3`,
      transcript:
        'Memory, emotion, and bonding came together in the limbic system. The hippocampus builds maps of places and stores events. Together with feelings, this let mammals learn quickly and care for their young.',
    },
    tags: ['limbic system', 'hippocampus', 'amygdala', 'memory'],
    sources: [
      { label: "Rodríguez et al. (2002). Spatial memory and hippocampal pallium through vertebrate evolution. Brain Research Bulletin", url: "https://doi.org/10.1016/s0361-9230(01)00682-7" },
    ],
  },
  {
    breakthrough: 'simulating',
    id: 'kpg-mammal-radiation',
    yearsAgo: 66_000_000,
    yearLabel: '66 million years ago',
    era: 'mammal',
    title: 'Dinosaurs Fall and Mammals Radiate',
    summary:
      'After the Chicxulub impact and the end-Cretaceous extinction, surviving mammals diversify rapidly into the empty ecological niches.',
    brainSignificance:
      "Freed from hiding in the night, mammals evolved a wide range of sizes, diets and habitats. At first their bodies grew faster than their brains, so relative brain size fell; bigger brains, built largely on the senses, came later, in the Eocene.",
    details:
      "Within about fifteen million years, placental mammals occupied many niches, from early whales and bats to hoofed mammals and primates.",
    image: { src: `/media/kpg-mammal-radiation.svg`, alt: 'Meteor in the sky over small surviving mammals' },
    audio: {
      src: `/media/kpg-mammal-radiation.mp3`,
      transcript:
        "When the dinosaurs vanished, mammals inherited the Earth. They spread into new habitats and lifestyles, and at first their bodies grew faster than their brains. Bigger brains followed millions of years later.",
    },
    tags: ['K-Pg extinction', 'adaptive radiation', 'placental mammals'],
    sources: [
      { label: "Bertrand et al. (2022). Brawn before brains in placental mammals after the end-Cretaceous extinction. Science", url: "https://doi.org/10.1126/science.abl5584" },
    ],
  },
  {
    breakthrough: 'mentalizing',
    id: 'first-primates',
    yearsAgo: 60_000_000,
    yearLabel: 'about 60 million years ago',
    era: 'primate',
    title: 'The First Primates Climb into the Trees',
    summary:
      'Small arboreal mammals, first plesiadapiforms and then true primates, adapt to life in tropical forest canopies with grasping hands and feet.',
    brainSignificance:
      'Moving through branches demands precise hand-eye coordination and depth judgment. Motor and somatosensory cortex for the hands, and visual processing areas, expanded as the primate brain began to trade smell for sight.',
    details:
      "Purgatorius, a squirrel-sized tree climber that may be the earliest primate relative, appears soon after the asteroid impact. Early true primates such as Teilhardina and Archicebus, about 55 million years ago, show nails instead of claws and larger eye sockets. Exactly which fossils count as the first primates is still debated.",
    image: { src: `/media/first-primates.svg`, alt: 'Small primate gripping a branch in a forest canopy' },
    audio: {
      src: `/media/first-primates.mp3`,
      transcript:
        'Early primates lived in the trees. Grasping branches and leaping between them called for careful vision and fine touch. The brain started to devote more tissue to hands and eyes.',
    },
    tags: ['primates', 'arboreal', 'grasping'],
    sources: [
      { label: "Ni et al. (2013). The oldest known primate skeleton and early haplorhine evolution. Nature", url: "https://doi.org/10.1038/nature12200" },
      { label: "Chester et al. (2015). Oldest known euarchontan tarsals and affinities of Paleocene Purgatorius to Primates. PNAS", url: "https://doi.org/10.1073/pnas.1421707112" },
    ],
  },
  {
    breakthrough: 'mentalizing',
    id: 'forward-eyes-visual-cortex',
    yearsAgo: 55_000_000,
    yearLabel: 'about 55 million years ago',
    era: 'primate',
    title: 'Forward-Facing Eyes and a Visual Brain',
    summary:
      'Primate eyes shift to the front of the face, giving overlapping visual fields and stereoscopic depth perception.',
    brainSignificance:
      'Input from both eyes converges in visual cortex, which compares the two views to compute depth. A large primary visual cortex (V1) and many additional visual areas evolved, so vision became the dominant primate sense and claimed a large share of cortex.',
    details:
      'Visual predation on insects, grasping fruit, and leaping between branches are all proposed pressures. Bony postorbital bars protect the eyes in early primates.',
    image: { src: `/media/forward-eyes-visual-cortex.svg`, alt: 'Primate face with overlapping visual fields' },
    audio: {
      src: `/media/forward-eyes-visual-cortex.mp3`,
      transcript:
        'Two eyes facing forward give two slightly different views of the same scene. The brain compares them to see depth. A large visual cortex grew to process all of this, and vision became the main primate sense.',
    },
    tags: ['stereopsis', 'visual cortex', 'V1', 'depth perception'],
    sources: [
      { label: "Cartmill (1974). Rethinking primate origins. Science", url: "https://doi.org/10.1126/science.184.4135.436" },
    ],
  },
  {
    breakthrough: 'mentalizing',
    id: 'trichromatic-vision',
    yearsAgo: 35_000_000,
    yearLabel: 'about 35 million years ago',
    era: 'primate',
    title: 'Trichromatic Color Vision',
    summary:
      'Old World monkeys and apes gain a third cone type through duplication of the opsin gene on the X chromosome, giving full three-color vision.',
    brainSignificance:
      'Telling red from green helps find ripe fruit and young leaves. Color-processing pathways in visual cortex took on a new channel, and colored signals such as facial flushing could become social messages.',
    details:
      'Most New World monkeys have only partial trichromacy, with howler monkeys evolving it independently. Most other mammals are dichromats.',
    image: { src: `/media/trichromatic-vision.svg`, alt: 'Monkey picking ripe red fruit among green leaves' },
    audio: {
      src: `/media/trichromatic-vision.mp3`,
      transcript:
        'A small gene duplication gave our ancestors a third kind of color receptor. Suddenly ripe fruit stood out from leaves. The brain gained a new color channel to interpret.',
    },
    tags: ['color vision', 'opsin', 'cones', 'trichromacy'],
    sources: [
      { label: "Jacobs (2009). Evolution of colour vision in mammals. Philosophical Transactions of the Royal Society B", url: "https://doi.org/10.1098/rstb.2009.0039" },
    ],
  },
  {
    breakthrough: 'mentalizing',
    id: 'prefrontal-expansion',
    yearsAgo: 30_000_000,
    yearLabel: 'about 30 million years ago',
    era: 'primate',
    title: 'Monkeys and the Growing Prefrontal Cortex',
    summary:
      "Anthropoid primates, the monkeys and apes, evolve larger brains with an expanded, more specialised prefrontal cortex. Its granular areas, a primate innovation, grew further.",
    brainSignificance:
      'The prefrontal cortex supports working memory, planning, attention, and the inhibition of impulses. In anthropoids it is richly connected with sensory and parietal cortex, allowing flexible, goal-directed behavior and learning from experience.',
    details:
      'Granular prefrontal cortex, with a distinct layer IV, is characteristic of primates. Its proportion rises further in apes and dramatically in humans.',
    image: { src: `/media/prefrontal-expansion.svg`, alt: 'Monkey brain with the frontal lobe highlighted' },
    audio: {
      src: `/media/prefrontal-expansion.mp3`,
      transcript:
        'Monkeys and apes enlarged the front of the brain. This area holds information in mind, plans ahead, and holds back impulses. It is the beginning of the thoughtful, flexible behavior we recognize in ourselves.',
    },
    tags: ['prefrontal cortex', 'working memory', 'anthropoid', 'executive function'],
    sources: [
      { label: "Preuss (1995). Do rats have prefrontal cortex? The Rose-Woolsey-Akert program reconsidered. Journal of Cognitive Neuroscience", url: "https://doi.org/10.1162/jocn.1995.7.1.1" },
    ],
  },
  {
    breakthrough: 'mentalizing',
    id: 'social-brain',
    yearsAgo: 25_000_000,
    yearLabel: 'about 25 million years ago',
    era: 'primate',
    title: 'Group Living Drives Bigger Brains',
    summary:
      'Across primates, group size correlates with relative neocortex size, a pattern known as the social brain hypothesis.',
    brainSignificance:
      'Tracking relationships, alliances, grooming partners, and rivals is a hard cognitive problem. Robin Dunbar and colleagues argued that the demands of social life, more than diet or ecology alone, pushed primate brains to grow.',
    details:
      "The hypothesis remains debated: a 2017 comparison of over 140 primate species found that diet predicted brain size better than group size. Social complexity is still widely seen as a major force, including in later hominin evolution.",
    image: { src: `/media/social-brain.svg`, alt: 'Group of monkeys grooming each other' },
    audio: {
      src: `/media/social-brain.mp3`,
      transcript:
        'Primates who live in larger groups tend to have a larger neocortex. Keeping track of who is friend, rival, or relative is a demanding mental task. That social puzzle is one major reason these brains grew.',
    },
    tags: ['social brain hypothesis', 'Dunbar', 'group size', 'neocortex ratio'],
    sources: [
      { label: "Dunbar (1998). The social brain hypothesis. Evolutionary Anthropology", url: "https://doi.org/10.1002/(sici)1520-6505(1998)6:5<178::aid-evan5>3.0.co;2-8" },
      { label: "DeCasien, Williams & Higham (2017). Primate brain size is predicted by diet but not sociality. Nature Ecology & Evolution", url: "https://doi.org/10.1038/s41559-017-0112" },
    ],
  },
  {
    breakthrough: 'mentalizing',
    id: 'great-ape-cognition',
    yearsAgo: 14_000_000,
    yearLabel: 'about 14 million years ago',
    era: 'primate',
    title: 'Great Apes: Reasoning, Tools, and Culture',
    summary:
      'The great apes (orangutans, gorillas, chimpanzees, and bonobos) share large brains and abilities such as planning, tool use, and social learning.',
    brainSignificance:
      'Apes can reason about causes, anticipate others’ goals, solve novel problems, and pass on local traditions. Large frontal and parietal association areas, and spindle neurons in some species, may support such flexible thinking.',
    details:
      'The orangutan lineage split from the African apes roughly 14 million years ago. Cognitive traits shared across great apes suggest that many were already present in their common ancestor.',
    image: { src: `/media/great-ape-cognition.svg`, alt: 'Chimpanzee using a stick as a tool' },
    audio: {
      src: `/media/great-ape-cognition.mp3`,
      transcript:
        'The great apes are our close relatives and impressive thinkers. They make and use tools, plan ahead, and teach habits to others. Many of these skills probably began in a shared ancestor millions of years ago.',
    },
    tags: ['great apes', 'tool use', 'culture', 'spindle neurons'],
    sources: [
      { label: "Whiten et al. (1999). Cultures in chimpanzees. Nature", url: "https://doi.org/10.1038/21415" },
      { label: "Allman et al. (2010). The von Economo neurons in apes and humans. American Journal of Human Biology", url: "https://doi.org/10.1002/ajhb.21136" },
    ],
  },
  {
    breakthrough: 'mentalizing',
    id: 'mirror-self-recognition',
    yearsAgo: 10_000_000,
    yearLabel: "~14 to 10 million years ago (inferred)",
    era: 'primate',
    title: 'Recognizing Oneself in the Mirror',
    summary:
      'Chimpanzees, bonobos, orangutans, and humans pass the mirror test, suggesting a self-concept that probably arose in a common great ape ancestor.',
    brainSignificance:
      'Passing the test means treating the reflection as oneself, which implies self-awareness and a mental model of the body. It draws on parietal and prefrontal networks that later underpin perspective-taking and empathy.',
    details:
      'Gorillas rarely pass, and results depend on an animal’s experience. The date is inferred from phylogeny, since behavior does not fossilize. Dolphins, elephants, and magpies also show evidence of mirror self-recognition, evolved independently.',
    image: { src: `/media/mirror-self-recognition.svg`, alt: 'Ape touching a mark on its face in a mirror' },
    audio: {
      src: `/media/mirror-self-recognition.mp3`,
      transcript:
        'Put a mark on a chimpanzee’s face and show it a mirror, and it touches the mark on itself. That is the mirror test. It suggests a sense of self that we share with our closest relatives.',
    },
    tags: ['mirror test', 'self-awareness', 'Gallup', 'theory of mind'],
    sources: [
      { label: "Gallup (1970). Chimpanzees: self-recognition. Science", url: "https://doi.org/10.1126/science.167.3914.86" },
      { label: "Reiss & Marino (2001). Mirror self-recognition in the bottlenose dolphin. PNAS", url: "https://doi.org/10.1073/pnas.101086398" },
      { label: "Plotnik, de Waal & Reiss (2006). Self-recognition in an Asian elephant. PNAS", url: "https://doi.org/10.1073/pnas.0608062103" },
    ],
  },
  {
    breakthrough: 'simulating',
    id: 'vicarious-trial-and-error-replay',
    yearsAgo: 110_000_000,
    yearLabel: '~110 million years ago (inferred)',
    era: 'mammal',
    title: 'Imagining Paths: Replay in the Hippocampus',
    summary:
      'At decision points, rats pause and look back and forth between options, a behavior called vicarious trial and error. Recordings show hippocampal place cells running through possible routes, and replaying past ones, in compressed time. The date is inferred from what living mammals do.',
    brainSignificance:
      'This is among the clearest evidence that a mammal can run an internal model of space before committing to action. Replay may also help consolidate memories and evaluate options. It lets an animal test a path in its head rather than with its body.',
    details:
      'Key findings come from rodent studies by David Redish, David Foster, Matthew Wilson and others. How far similar processes extend across all mammals, and how much they amount to deliberate imagination, is still being studied.',
    image: {
      src: '/media/vicarious-trial-and-error-replay.svg',
      alt: 'Illustration of a rat at a maze junction with ghostly paths branching from its head',
    },
    audio: {
      src: '/media/vicarious-trial-and-error-replay.mp3',
      transcript:
        'A rat at a fork in a maze sometimes stops and looks both ways. In its hippocampus, cells fire in sequence as if it were walking down each path. This looks like a simple form of imagining, and it lets mammals try options before acting.',
    },
    tags: ['hippocampus','place cells','replay','vicarious trial and error'],
    sources: [
      { label: "Johnson & Redish (2007). Neural ensembles in CA3 transiently encode paths forward of the animal at a decision point. Journal of Neuroscience", url: "https://doi.org/10.1523/jneurosci.3761-07.2007" },
      { label: "Pfeiffer & Foster (2013). Hippocampal place-cell sequences depict future paths to remembered goals. Nature", url: "https://doi.org/10.1038/nature12112" },
    ],
  },
  {
    breakthrough: 'simulating',
    id: 'agranular-prefrontal-simulation',
    yearsAgo: 100_000_000,
    yearLabel: '~100 million years ago (inferred)',
    era: 'mammal',
    title: 'Agranular Prefrontal Cortex and Mental Simulation',
    summary:
      'Early mammals had agranular frontal cortex, cortex lacking the thick input layer 4 of sensory areas, which appears to have linked the neocortex with the amygdala and basal ganglia. The timing is inferred from living mammals; it does not fossilize.',
    brainSignificance:
      'One proposal, developed by Max Bennett and others, holds that this region helps decide when to simulate, choosing which imagined path to run and judging it against goals and feelings. It would connect an internal world model to the older reinforcement system.',
    details:
      'This is a hypothesis built from comparative anatomy and rodent studies of planning and deliberation. Whether rodent frontal cortex is truly homologous to primate prefrontal cortex remains debated.',
    image: {
      src: '/media/agranular-prefrontal-simulation.svg',
      alt: 'Side view of a small mammal brain with the frontal cortex highlighted and linked to the hippocampus and basal ganglia',
    },
    audio: {
      src: '/media/agranular-prefrontal-simulation.mp3',
      transcript:
        'Early mammals developed frontal cortex that connects the new neocortex to the older brain systems for emotion and action. It may have decided when to imagine, and which imagined outcomes were worth acting on. This is a hypothesis, and it is still being tested.',
    },
    tags: ['prefrontal cortex','agranular','planning','simulation'],
    sources: [
      { label: "Laubach et al. (2018). What, if anything, is rodent prefrontal cortex? eNeuro", url: "https://doi.org/10.1523/eneuro.0315-18.2018" },
      { label: "Bennett (2023). A Brief History of Intelligence. Mariner Books", url: "https://www.hachettebookgroup.com/titles/max-bennett/a-brief-history-of-intelligence/9780063286375/" },
    ],
  },
  {
    breakthrough: 'mentalizing',
    id: 'imitation-learning-primates',
    yearsAgo: 18_000_000,
    yearLabel: '~18 million years ago (inferred)',
    era: 'primate',
    title: 'Learning by Watching: Imitation and Mirror Neurons',
    summary:
      'Monkeys and apes learn by watching others, and neurons in macaque premotor cortex respond both to performing an action and to seeing it performed. The date is inferred from what living primates share.',
    brainSignificance:
      'Observing a skilled neighbor lets an individual skip costly trial and error. Mirror-like responses may help link what one sees with what one can do, though their exact role in understanding others is debated.',
    details:
      'Mirror neurons were reported in macaques by Giacomo Rizzolatti and colleagues in the 1990s. Strong claims that they explain empathy or language remain contested.',
    image: {
      src: '/media/imitation-learning-primates.svg',
      alt: 'Young ape watching an adult crack a nut, with matching glowing neurons in both brains',
    },
    audio: {
      src: '/media/imitation-learning-primates.mp3',
      transcript:
        'Primates learn a great deal by watching. In monkeys, some neurons fire both when the animal grasps an object and when it sees another grasp. Watching others lets one individual inherit the lessons of many.',
    },
    tags: ['imitation','mirror neurons','social learning','premotor cortex'],
    sources: [
      { label: "Rizzolatti & Craighero (2004). The mirror-neuron system. Annual Review of Neuroscience", url: "https://doi.org/10.1146/annurev.neuro.27.070203.144230" },
      { label: "Heyes (2009). Evolution, development and intentional control of imitation. Philosophical Transactions of the Royal Society B", url: "https://doi.org/10.1098/rstb.2009.0049" },
    ],
  },
  {
    breakthrough: 'mentalizing',
    id: 'mental-state-inference-primates',
    yearsAgo: 12_000_000,
    yearLabel: '~12 million years ago (inferred)',
    era: 'primate',
    title: 'Inferring What Others Know and Want',
    summary:
      'Great apes track what others see, want and intend, and sometimes act on what a rival knows. Whether they grasp false beliefs is debated, and the date is inferred from shared abilities in living apes.',
    brainSignificance:
      'Primates seem to model other minds using the same machinery they use to model themselves and the world: simulating a simulation. Granular prefrontal cortex and related areas are thought to support this.',
    details:
      'Experiments by Josep Call, Michael Tomasello, Christopher Krupenye and others show anticipatory looking and strategic behavior in apes. Interpretations differ between rich mind-reading and simpler behavior-reading.',
    image: {
      src: '/media/mental-state-inference-primates.svg',
      alt: 'Two apes with a hidden food item, one with a thought bubble showing what the other can see',
    },
    audio: {
      src: '/media/mental-state-inference-primates.mp3',
      transcript:
        'Apes keep track of what others can see and want. A subordinate chimpanzee may take food that a dominant one cannot see. Scientists debate how much this is true mind-reading, but it points to a model of other minds.',
    },
    tags: ['theory of mind','mentalizing','granular prefrontal','apes'],
    sources: [
      { label: "Hare, Call & Tomasello (2001). Do chimpanzees know what conspecifics know? Animal Behaviour", url: "https://doi.org/10.1006/anbe.2000.1518" },
      { label: "Krupenye et al. (2016). Great apes anticipate that other individuals will act according to false beliefs. Science", url: "https://doi.org/10.1126/science.aaf8110" },
    ],
  },
];
