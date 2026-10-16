import type { TimelineEvent } from '../types';

export const sapiensModernEvents: TimelineEvent[] = [
  {
    breakthrough: 'speaking',
    id: 'jebel-irhoud-sapiens',
    yearsAgo: 315_000,
    yearLabel: "~315,000 years ago",
    era: 'sapiens',
    title: 'The Earliest Homo sapiens',
    summary:
      'Fossils from Jebel Irhoud in Morocco show a face and teeth much like ours, making them the oldest known Homo sapiens.',
    brainSignificance:
      'Brain size was already within the modern range, but the braincase was still long and low. The hardware was nearly in place, and its internal wiring was still being reshaped.',
    details:
      "Dated to about 315,000 years ago, the Jebel Irhoud finds support the idea that our species took shape across much of Africa rather than in one small region.",
    brainVolumeCc: 1300,
    image: {
      src: '/media/jebel-irhoud-sapiens.svg',
      alt: 'Elongated skull from Jebel Irhoud with a modern-looking face',
    },
    audio: {
      src: '/media/jebel-irhoud-sapiens.mp3',
      transcript:
        'In the hills of Morocco, researchers found skulls about three hundred thousand years old. The faces look strikingly like ours. Inside, the brain was already large, though not yet shaped like ours.',
    },
    tags: ['Homo sapiens', 'Jebel Irhoud', 'Morocco'],
    sources: [
      { label: "Hublin et al. (2017). New fossils from Jebel Irhoud, Morocco and the pan-African origin of Homo sapiens. Nature", url: "https://doi.org/10.1038/nature22336" },
      { label: "Richter et al. (2017). The age of the hominin fossils from Jebel Irhoud, Morocco, and the origins of the Middle Stone Age. Nature", url: "https://doi.org/10.1038/nature22335" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'globular-brain',
    yearsAgo: 150_000,
    yearLabel: '~300,000 to 35,000 years ago',
    era: 'sapiens',
    title: 'The Globular Brain',
    summary:
      "Over some two hundred thousand years, the sapiens braincase changed from long and low to rounded and tall, reaching today’s shape between about 100,000 and 35,000 years ago.",
    brainSignificance:
      'Brain size stayed about the same, but the proportions shifted. The parietal lobes and cerebellum expanded, regions tied to spatial reasoning, imagination and the integration of senses. This reorganization may be what set us apart.',
    brainVolumeCc: 1350,
    image: {
      src: '/media/globular-brain.svg',
      alt: 'Side-by-side outlines of an elongated and a globular skull',
    },
    audio: {
      src: '/media/globular-brain.mp3',
      transcript:
        'Our brains did not simply grow. They changed shape, becoming rounder and more globular. Expanded parietal areas and cerebellum may have supported new ways of thinking and planning.',
    },
    tags: ['endocast', 'parietal lobe', 'cerebellum'],
    sources: [
      { label: "Neubauer, Hublin & Gunz (2018). The evolution of modern human brain shape. Science Advances", url: "https://doi.org/10.1126/sciadv.aao5961" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'ochre-symbolic-thought',
    yearsAgo: 100000,
    yearLabel: '~100,000 years ago',
    era: 'sapiens',
    title: 'Ochre and Symbolic Thought',
    summary:
      "At Blombos Cave in South Africa, people processed red ochre, engraved patterns into it and made shell beads.",
    brainSignificance:
      'Using colour and pattern to stand for identity or ideas needs a mind that links an object to a meaning beyond itself. Symbolism is the foundation of art, ritual and eventually writing.',
    details:
      "Blombos yielded an ochre-processing kit about 100,000 years old, ochre engraved with a crosshatch pattern from about 75,000 years ago, and a drawing in ochre crayon on stone about 73,000 years old.",
    image: {
      src: '/media/ochre-symbolic-thought.svg',
      alt: 'Piece of red ochre engraved with a crosshatch pattern',
    },
    audio: {
      src: '/media/ochre-symbolic-thought.mp3',
      transcript:
        'In a cave on the South African coast, people ground red ochre and engraved patterns into it. They strung shell beads. These were signs that stood for something, an early flicker of symbolic thought.',
    },
    tags: ['ochre', 'Blombos Cave', 'symbolism', 'beads'],
    sources: [
      { label: "Henshilwood et al. (2011). A 100,000-year-old ochre-processing workshop at Blombos Cave, South Africa. Science", url: "https://doi.org/10.1126/science.1211535" },
      { label: "Henshilwood et al. (2018). An abstract drawing from the 73,000-year-old levels at Blombos Cave, South Africa. Nature", url: "https://doi.org/10.1038/s41586-018-0514-3" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'language-foxp2',
    yearsAgo: 70000,
    yearLabel: '~200,000 to 50,000 years ago',
    era: 'sapiens',
    title: 'Language and FOXP2',
    summary:
      'Fully grammatical language probably existed by the time humans spread out of Africa. The gene FOXP2, tied to speech and orofacial control, carries two changes unique to the human lineage.',
    brainSignificance:
      'Language lets one mind pass its thoughts to another, so knowledge could accumulate across generations. It rests on networks that link the left frontal and temporal cortex with the basal ganglia and cerebellum. FOXP2 is one contributor, not a single language gene.',
    details:
      "Neanderthals carried the same FOXP2 variant, and a 2018 study found no sign of a recent selective sweep at the gene in living humans, so it cannot date the origin of speech.",
    image: {
      src: '/media/language-foxp2.svg',
      alt: 'Brain outline with language areas and a DNA strand highlighted',
    },
    audio: {
      src: '/media/language-foxp2.mp3',
      transcript:
        'Language is hard to find in fossils, but it left clues. The gene FOXP2 helps control the fine movements of speech. With words and grammar, minds could share plans, stories and memories.',
    },
    tags: ['language', 'FOXP2', 'grammar', 'speech'],
    sources: [
      { label: "Enard et al. (2002). Molecular evolution of FOXP2, a gene involved in speech and language. Nature", url: "https://doi.org/10.1038/nature01025" },
      { label: "Krause et al. (2007). The derived FOXP2 variant of modern humans was shared with Neandertals. Current Biology", url: "https://doi.org/10.1016/j.cub.2007.10.008" },
      { label: "Atkinson et al. (2018). No evidence for recent selection at FOXP2 among diverse human populations. Cell", url: "https://doi.org/10.1016/j.cell.2018.06.048" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'out-of-africa',
    yearsAgo: 60000,
    yearLabel: '~60,000 years ago',
    era: 'sapiens',
    title: 'Out of Africa',
    summary:
      "Descendants of a population in Africa spread across Eurasia, reaching Australia by about 50,000 years ago and the Americas by about 23,000 years ago, judging by footprints at White Sands in New Mexico.",
    brainSignificance:
      'Settling deserts, ice-age tundra and open sea demanded flexible planning, cooperation and cultural learning. Our large, adaptable brains, not new anatomy, let one species occupy nearly every habitat on Earth.',
    details:
      'Along the way sapiens met and interbred with Neanderthals and Denisovans, and most people today carry a small share of their DNA.',
    image: {
      src: '/media/out-of-africa.svg',
      alt: 'World map with arrows spreading outward from Africa',
    },
    audio: {
      src: '/media/out-of-africa.mp3',
      transcript:
        'Around sixty thousand years ago, groups of modern humans left Africa for good. They crossed deserts, mountains and seas. Their flexible, social brains carried them to every continent but Antarctica.',
    },
    tags: ['migration', 'Neanderthals', 'Denisovans'],
    sources: [
      { label: "Nielsen et al. (2017). Tracing the peopling of the world through genomics. Nature", url: "https://doi.org/10.1038/nature21347" },
      { label: "Bennett et al. (2021). Evidence of humans in North America during the Last Glacial Maximum. Science", url: "https://doi.org/10.1126/science.abg7586" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'cave-art',
    yearsAgo: 51_000,
    yearLabel: "From at least 51,000 years ago",
    era: 'sapiens',
    title: 'Cave Art',
    summary:
      'People painted animals and hand stencils on cave walls, from Sulawesi in Indonesia to Chauvet and Lascaux in France.',
    brainSignificance:
      'A painted pig or bison on a wall means the artist could hold a mental image, plan it, and expect others to understand it. It shows imagination, visual memory and shared meaning at work.',
    details:
      "A scene of human-like figures and a pig on Sulawesi is at least 51,200 years old, the oldest known figurative art. The paintings at Chauvet are about 36,000 years old and those at Lascaux about 17,000.",
    image: {
      src: '/media/cave-art.svg',
      alt: 'Painted bison and hand stencils on a cave wall',
    },
    audio: {
      src: '/media/cave-art.mp3',
      transcript:
        'By torchlight, people painted animals on cave walls and pressed their hands against the stone. Each image began as a picture in the mind. Art made the inner world visible to others.',
    },
    tags: ['art', 'Sulawesi', 'Chauvet', 'imagination'],
    sources: [
      { label: "Oktaviana et al. (2024). Narrative cave art in Indonesia by 51,200 years ago. Nature", url: "https://doi.org/10.1038/s41586-024-07541-7" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'bone-flutes-music',
    yearsAgo: 42_000,
    yearLabel: "~42,000 years ago",
    era: 'sapiens',
    title: 'Bone Flutes and Music',
    summary:
      "Flutes carved from bird bone and mammoth ivory, found in caves of the Swabian Jura in Germany, are about 40,000 years old or more, among the oldest known instruments.",
    brainSignificance:
      'Music engages auditory, motor, memory and reward circuits together. It binds groups through shared rhythm and emotion, and it probably strengthened social bonds long before written words.',
    image: {
      src: '/media/bone-flutes-music.svg',
      alt: 'Bone flute with finger holes carved from a vulture wing bone',
    },
    audio: {
      src: '/media/bone-flutes-music.mp3',
      transcript:
        'In caves in Germany, people carved flutes from bird bone and ivory. Music lights up many parts of the brain at once. It may have helped early communities bond and share feelings.',
    },
    tags: ['music', 'Hohle Fels', 'rhythm', 'social bonding'],
    sources: [
      { label: "Conard, Malina & Münzel (2009). New flutes document the earliest musical tradition in southwestern Germany. Nature", url: "https://doi.org/10.1038/nature08169" },
      { label: "Higham et al. (2012). Testing models for the beginnings of the Aurignacian and the advent of figurative art and music. Journal of Human Evolution", url: "https://doi.org/10.1016/j.jhevol.2012.03.003" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'burial-ritual',
    yearsAgo: 34_000,
    yearLabel: "~34,000 years ago (simpler graves far earlier)",
    era: 'sapiens',
    title: 'Burial and Ritual',
    summary:
      "At Sunghir in Russia, about 34,000 years ago, people were buried with thousands of hand-made ivory beads. Simpler graves are much older: a child laid to rest at Panga ya Saidi in Kenya about 78,000 years ago, and burials at Qafzeh in Israel around 100,000 years ago.",
    brainSignificance:
      'Burying the dead suggests an understanding of death, grief and perhaps an afterlife. It reflects the capacity to imagine what cannot be seen and to share that belief with a community.',
    image: {
      src: '/media/burial-ritual.svg',
      alt: 'Grave with a skeleton surrounded by beads and ochre',
    },
    audio: {
      src: '/media/burial-ritual.mp3',
      transcript:
        'People started laying their dead in graves, often with gifts of beads, ochre or tools. This hints at grief, memory and a concept of death. The brain was now imagining beyond the present moment.',
    },
    tags: ['burial', 'ritual', 'death', 'Qafzeh'],
    sources: [
      { label: "Sikora et al. (2017). Ancient genomes show social and reproductive behavior of early Upper Paleolithic foragers. Science", url: "https://doi.org/10.1126/science.aao1807" },
      { label: "Martinón-Torres et al. (2021). Earliest known human burial in Africa. Nature", url: "https://doi.org/10.1038/s41586-021-03457-8" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'behavioural-modernity',
    yearsAgo: 30000,
    yearLabel: '~50,000 to 30,000 years ago',
    era: 'sapiens',
    title: 'Behavioural Modernity',
    summary:
      'Toolkits grew richer and more varied, with blades, needles, projectile points, ornaments and long-distance trade networks.',
    brainSignificance:
      'Innovations began to pile up and be passed on rather than lost. This ratchet of cumulative culture, powered by teaching, language and large social groups, made culture a force as important as genes.',
    details:
      'Many of these traits appear in Africa much earlier, so behavioural modernity looks more like a gradual build-up than a sudden revolution.',
    image: {
      src: '/media/behavioural-modernity.svg',
      alt: 'Display of stone blades, a bone needle and shell ornaments',
    },
    audio: {
      src: '/media/behavioural-modernity.mp3',
      transcript:
        'Tools became finer and more varied. People sewed clothing, traded over long distances and wore ornaments. Culture itself became cumulative, as each generation built on what the last had learned.',
    },
    tags: ['cumulative culture', 'toolkits', 'trade'],
    sources: [
      { label: "McBrearty & Brooks (2000). The revolution that wasn’t: a new interpretation of the origin of modern human behavior. Journal of Human Evolution", url: "https://doi.org/10.1006/jhev.2000.0435" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'agriculture',
    yearsAgo: 11000,
    yearLabel: '~11,000 years ago',
    era: 'modern',
    title: 'Agriculture',
    summary:
      'In the Fertile Crescent and elsewhere, people began to plant crops and herd animals, settling in villages that grew into towns.',
    brainSignificance:
      "Settled life created larger societies, surplus food and specialised roles. It put new demands on memory, planning, numeracy and cooperation among strangers. Human brains are slightly smaller now than in the late Ice Age; when that happened, and why, is debated.",
    image: {
      src: '/media/agriculture.svg',
      alt: 'Hands sowing wheat seeds beside a mud-brick village',
    },
    audio: {
      src: '/media/agriculture.mp3',
      transcript:
        'About eleven thousand years ago, people began to sow grain and keep animals. Villages and towns followed. Life in bigger groups called for counting, planning and trust among many people.',
    },
    tags: ['Neolithic', 'farming', 'settlement'],
    sources: [
      { label: "Zeder (2011). The origins of agriculture in the Near East. Current Anthropology", url: "https://doi.org/10.1086/659307" },
      { label: "DeSilva et al. (2021). When and why did human brains decrease in size? Frontiers in Ecology and Evolution", url: "https://doi.org/10.3389/fevo.2021.742639" },
      { label: "Villmoare & Grabowski (2022). Did the transition to complex societies in the Holocene drive a reduction in brain size? Frontiers in Ecology and Evolution", url: "https://doi.org/10.3389/fevo.2022.963568" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'writing',
    yearsAgo: 5200,
    yearLabel: '~5,200 years ago',
    era: 'modern',
    title: 'Writing',
    summary:
      'In Sumer, wedge-shaped marks pressed into clay recorded grain, livestock and taxes, and later, stories and laws.',
    brainSignificance:
      'Reading is far too recent to have shaped a dedicated brain region through evolution. Instead, learning to read recycles visual areas of the left occipitotemporal cortex. Writing extended memory outside the skull.',
    details:
      "Egyptian hieroglyphs appeared at about the same time; Chinese and Mesoamerican scripts arose later and independently.",
    image: {
      src: '/media/writing.svg',
      alt: 'Clay tablet with cuneiform wedge marks',
    },
    audio: {
      src: '/media/writing.mp3',
      transcript:
        'Around five thousand two hundred years ago, scribes in Sumer pressed marks into clay. Reading repurposes parts of the visual brain that evolved for other tasks. Writing gave humanity a memory beyond any single mind.',
    },
    tags: ['cuneiform', 'literacy', 'Sumer', 'external memory'],
    sources: [
      { label: "Dehaene & Cohen (2011). The unique role of the visual word form area in reading. Trends in Cognitive Sciences", url: "https://doi.org/10.1016/j.tics.2011.04.003" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'alphabet',
    yearsAgo: 3800,
    yearLabel: '~3,800 years ago',
    era: 'modern',
    title: 'The Alphabet',
    summary:
      'Workers in Egypt and the Levant devised a small set of letters that stood for sounds. The Phoenician and then the Greek alphabet spread across the Mediterranean.',
    brainSignificance:
      'A few dozen symbols replaced hundreds, so reading became far easier to learn. Mapping letters to speech sounds links visual and language networks, and it opened literacy to far more people.',
    image: {
      src: '/media/alphabet.svg',
      alt: 'Early alphabetic letters inscribed on a stone fragment',
    },
    audio: {
      src: '/media/alphabet.mp3',
      transcript:
        'Alphabets trimmed writing down to a few dozen letters, each standing for a sound. That made reading far easier to learn. More minds could now take part in the written world.',
    },
    tags: ['alphabet', 'Phoenician', 'Greek', 'literacy'],
    sources: [
      { label: "Gardiner (1962). Once again the Proto-Sinaitic inscriptions. Journal of Egyptian Archaeology", url: "https://doi.org/10.2307/3855782" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'philosophy-of-mind',
    yearsAgo: 2500,
    yearLabel: '~2,500 years ago',
    era: 'modern',
    title: 'Philosophy and the Seat of the Mind',
    summary:
      'Thinkers in Greece, India and China began to ask what the mind is. Alcmaeon and Hippocrates located thought in the brain, while Aristotle argued for the heart.',
    brainSignificance:
      'For the first time the brain turned to study itself. Hippocrates wrote that from the brain come our pleasures, joys, laughter and sorrows. Later, Galen showed through dissection that nerves lead to the brain.',
    image: {
      src: '/media/philosophy-of-mind.svg',
      alt: 'Bust of a Greek philosopher beside a sketch of the brain',
    },
    audio: {
      src: '/media/philosophy-of-mind.mp3',
      transcript:
        'Ancient thinkers began to ask what the mind is and where it lives. Hippocrates declared that the brain is the source of joy and sorrow. The brain had started to study itself.',
    },
    tags: ['Hippocrates', 'Aristotle', 'Galen', 'mind'],
    sources: [
      { label: "Hippocrates. On the Sacred Disease (trans. Francis Adams). MIT Internet Classics Archive", url: "http://classics.mit.edu/Hippocrates/sacred.html" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'printing-press',
    yearsAgo: 586,
    yearLabel: '~1440 CE (about 586 years ago)',
    era: 'modern',
    title: 'The Printing Press',
    summary:
      'Johannes Gutenberg introduced movable-type printing in Europe, making books cheap and plentiful.',
    brainSignificance:
      'Ideas could now travel faster than any single person and be checked by many. Mass literacy and the spread of knowledge became an engine of collective intelligence.',
    image: {
      src: '/media/printing-press.svg',
      alt: 'Wooden printing press with trays of metal type',
    },
    audio: {
      src: '/media/printing-press.mp3',
      transcript:
        'Around 1440, Gutenberg built a press with movable type. Books became cheap and ideas spread widely. Human knowledge could now accumulate and be questioned at a much larger scale.',
    },
    tags: ['Gutenberg', 'literacy', 'knowledge'],
    sources: [
      { label: "Eisenstein (1980). The Printing Press as an Agent of Change. Cambridge University Press", url: "https://doi.org/10.1017/cbo9781107049963" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'scientific-revolution',
    yearsAgo: 480,
    yearLabel: '~1543 to 1700 CE',
    era: 'modern',
    title: 'The Scientific Revolution',
    summary:
      'Vesalius published his anatomy of the human body in 1543, and Descartes, Willis and others began to treat the brain as an object of scientific study.',
    brainSignificance:
      'Thomas Willis mapped the brain and its blood supply in 1664 and linked brain regions to behaviour. The mind began to be explained through observation and experiment rather than doctrine alone.',
    details:
      'Descartes separated mind from body, a puzzle that neuroscience and philosophy are still working on.',
    image: {
      src: '/media/scientific-revolution.svg',
      alt: 'Anatomical engraving of the brain from the 1500s',
    },
    audio: {
      src: '/media/scientific-revolution.mp3',
      transcript:
        'In the sixteenth and seventeenth centuries, anatomists drew the brain with new accuracy. Thomas Willis tied brain structures to behaviour. Observation and experiment were becoming the tools for understanding the mind.',
    },
    tags: ['Vesalius', 'Descartes', 'Willis', 'anatomy'],
    sources: [
      { label: "Vesalius (1543). De humani corporis fabrica libri septem. Biodiversity Heritage Library", url: "https://doi.org/10.5962/bhl.title.109299" },
      { label: "Molnár (2004). Thomas Willis (1621–1675), the founder of clinical neuroscience. Nature Reviews Neuroscience", url: "https://doi.org/10.1038/nrn1369" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'neuron-doctrine',
    yearsAgo: 138,
    yearLabel: '1888 CE',
    era: 'modern',
    title: 'Neurons and the Localisation of Function',
    summary:
      "Paul Broca (1861) and Carl Wernicke (1874) linked damage in specific areas to loss of speech production and comprehension. In 1888 Santiago Ramón y Cajal showed that the nervous system is made of separate cells.",
    brainSignificance:
      'Broca and Wernicke proved that functions occupy particular places in the cortex. Cajal, using Golgi stains, showed that neurons are individual cells that communicate across gaps, the foundation of modern neuroscience. He shared the 1906 Nobel Prize with Camillo Golgi.',
    image: {
      src: '/media/neuron-doctrine.svg',
      alt: 'Cajal-style ink drawing of branching neurons',
    },
    audio: {
      src: '/media/neuron-doctrine.mp3',
      transcript:
        'Broca and Wernicke linked speech to specific regions of the cortex. Then Cajal looked through his microscope and drew the neurons themselves. The brain, he showed, is a network of separate cells.',
    },
    tags: ['Cajal', 'Broca', 'Wernicke', 'neuron doctrine'],
    sources: [
      { label: "The Nobel Prize in Physiology or Medicine 1906: Santiago Ramón y Cajal, facts", url: "https://www.nobelprize.org/prizes/medicine/1906/cajal/facts/" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'eeg',
    yearsAgo: 97,
    yearLabel: '1929 CE',
    era: 'modern',
    title: 'The EEG',
    summary:
      'Hans Berger published the first human electroencephalogram, recording the brain\'s electrical rhythms through the scalp.',
    brainSignificance:
      'For the first time scientists could watch a living brain at work without opening the skull. Brain waves became a window into sleep, attention, epilepsy and consciousness.',
    image: {
      src: '/media/eeg.svg',
      alt: 'Scalp electrodes and a trace of brain waves',
    },
    audio: {
      src: '/media/eeg.mp3',
      transcript:
        'In 1929 Hans Berger recorded electrical rhythms from the human scalp. Brain waves could now be watched in a living person. They revealed the patterns of sleep, attention and seizures.',
    },
    tags: ['EEG', 'Hans Berger', 'brain waves'],
    sources: [
      { label: "İnce, Adanır & Sevmez (2020). The inventor of electroencephalography (EEG): Hans Berger (1873–1941). Child’s Nervous System", url: "https://doi.org/10.1007/s00381-020-04564-z" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'fmri',
    yearsAgo: 34,
    yearLabel: '1990 to 1992 CE',
    era: 'modern',
    title: 'fMRI',
    summary:
      'Functional magnetic resonance imaging tracks changes in blood oxygen to show which brain regions are active, first demonstrated in humans in 1991-1992.',
    brainSignificance:
      'fMRI let researchers map networks for vision, memory, emotion and language in healthy people. Its measure is indirect and slow compared with neural firing, but it transformed cognitive neuroscience.',
    image: {
      src: '/media/fmri.svg',
      alt: 'Brain scan with coloured patches of activity',
    },
    audio: {
      src: '/media/fmri.mp3',
      transcript:
        'Functional MRI follows blood flow to reveal which parts of the brain are busy. It lets us see thinking, remembering and feeling in healthy people. Entire networks of the brain came into view.',
    },
    tags: ['fMRI', 'neuroimaging', 'BOLD signal'],
    sources: [
      { label: "Ogawa et al. (1990). Brain magnetic resonance imaging with contrast dependent on blood oxygenation. PNAS", url: "https://doi.org/10.1073/pnas.87.24.9868" },
      { label: "Kwong et al. (1992). Dynamic magnetic resonance imaging of human brain activity during primary sensory stimulation. PNAS", url: "https://doi.org/10.1073/pnas.89.12.5675" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'brain-computer-interfaces',
    yearsAgo: 20,
    yearLabel: '2004 CE onward',
    era: 'modern',
    title: 'Brain-Computer Interfaces',
    summary:
      'Implanted electrodes now let people with paralysis move cursors, robotic arms and even synthesised speech by thought alone, starting with clinical trials in 2004.',
    brainSignificance:
      'Decoding intentions from neural activity shows that the brain\'s signals can be read and used, and that it can learn to control new devices. This opens paths to restoring movement and communication.',
    image: {
      src: '/media/brain-computer-interfaces.svg',
      alt: 'Electrode array on the cortex connected to a robotic arm',
    },
    audio: {
      src: '/media/brain-computer-interfaces.mp3',
      transcript:
        'Tiny electrode arrays can now read movement and speech intentions from the cortex. People with paralysis have controlled cursors, robot arms and voice synthesisers by thought alone. The brain is learning to speak directly to machines.',
    },
    tags: ['BCI', 'neural implant', 'neuroprosthetics'],
    sources: [
      { label: "Hochberg et al. (2006). Neuronal ensemble control of prosthetic devices by a human with tetraplegia. Nature", url: "https://doi.org/10.1038/nature04970" },
      { label: "Willett et al. (2023). A high-performance speech neuroprosthesis. Nature", url: "https://doi.org/10.1038/s41586-023-06377-x" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'ai-mirror',
    yearsAgo: 10,
    yearLabel: '2012 CE onward',
    era: 'modern',
    title: 'AI as a Mirror',
    summary:
      'Artificial neural networks, loosely inspired by neurons, now recognise images, translate languages and hold conversations.',
    brainSignificance:
      'These systems differ greatly from real brains in design, energy use and learning, yet comparing them sharpens questions about what intelligence, understanding and consciousness really are. Machines now serve as models, and as a mirror, for the mind.',
    image: {
      src: '/media/ai-mirror.svg',
      alt: 'Network of connected nodes overlaid on a human head profile',
    },
    audio: {
      src: '/media/ai-mirror.mp3',
      transcript:
        'Neural networks, inspired loosely by the brain, can now see, translate and converse. They are very unlike biological brains. By comparing them with our own minds, we learn what intelligence might be.',
    },
    tags: ['artificial intelligence', 'neural networks', 'deep learning'],
    sources: [
      { label: "Krizhevsky, Sutskever & Hinton (2017). ImageNet classification with deep convolutional neural networks. Communications of the ACM", url: "https://doi.org/10.1145/3065386" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'now',
    yearsAgo: 0,
    yearLabel: 'Now',
    era: 'modern',
    title: 'Now',
    summary:
      'Roughly four billion years of evolution have led to a brain that can study its own origins.',
    brainSignificance:
      'The human brain holds about 86 billion neurons and uses about 20 watts. It is the product of a long, unplanned history, and the story is still being written, now in part by us.',
    brainVolumeCc: 1350,
    image: {
      src: '/media/now.svg',
      alt: 'Human silhouette looking toward a star-filled horizon',
    },
    audio: {
      src: '/media/now.mp3',
      transcript:
        'Here we are. A brain of eighty-six billion neurons, running on twenty watts, is looking back over its own history. What it does next is up to us.',
    },
    tags: ['present', 'consciousness', 'future'],
    sources: [
      { label: "Azevedo et al. (2009). Equal numbers of neuronal and nonneuronal cells make the human brain an isometrically scaled-up primate brain. Journal of Comparative Neurology", url: "https://doi.org/10.1002/cne.21974" },
      { label: "Raichle & Gusnard (2002). Appraising the brain’s energy budget. PNAS", url: "https://doi.org/10.1073/pnas.172399499" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'language-shares-simulations',
    yearsAgo: 80_000,
    yearLabel: '~100,000 to 50,000 years ago (debated)',
    era: 'sapiens',
    title: 'Language: Sharing Simulations',
    summary:
      'Language lets a speaker transfer an imagined scene, plan or past event into another mind with a few sounds. Its origin is hotly debated, and this date is a rough placeholder within a wide range.',
    brainSignificance:
      'Simulation was once private; speech made it shareable. Combined with mentalizing, language lets groups plan together, pass on knowledge and agree on shared fictions, and it allows learned symbols to outlast any individual.',
    details:
      'Chimpanzees and bonobos can learn some symbols, but nothing like open-ended grammar. Whether language emerged gradually or in a late step is unresolved.',
    image: {
      src: '/media/language-shares-simulations.svg',
      alt: 'Two humans at a fire, one speaking, with a glowing scene appearing in the listener thought bubble',
    },
    audio: {
      src: '/media/language-shares-simulations.mp3',
      transcript:
        'Until language, imagined scenes stayed inside one head. With words, a person can place a plan, a memory or a place in another mind. Language lets many brains work as one.',
    },
    tags: ['language','symbols','shared simulation','communication'],
    sources: [
      { label: "Hauser, Chomsky & Fitch (2002). The faculty of language: what is it, who has it, and how did it evolve? Science", url: "https://doi.org/10.1126/science.298.5598.1569" },
    ],
  },
];
