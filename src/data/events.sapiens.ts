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
      "In the hills of Morocco, researchers found skulls about 300,000 years old. The faces look strikingly like ours. Inside, the brain was already large, though not yet shaped like ours.",
    brainSignificance:
      'Brain size was already within the modern range, but the braincase was still long and low. The hardware was nearly in place, and its internal wiring was still being reshaped.',
    details:
      "Dated to about 315,000 years ago, the Jebel Irhoud finds support the idea that our species took shape across much of Africa rather than in one small region.",
    brainVolumeCc: 1300,
    image: {
      src: '/media/jebel-irhoud-sapiens.svg',
      alt: 'Elongated skull from Jebel Irhoud with a modern-looking face',
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
      "Our brains did not simply grow. They changed shape, becoming rounder and more globular. Expanded parietal areas and cerebellum may have supported new ways of thinking and planning.",
    brainSignificance:
      'Brain size stayed about the same, but the proportions shifted. The parietal lobes and cerebellum expanded, regions tied to spatial reasoning, imagination and the integration of senses. This reorganization may be what set us apart.',
    brainVolumeCc: 1350,
    image: {
      src: '/media/globular-brain.svg',
      alt: 'Side-by-side outlines of an elongated and a globular skull',
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
      "In a cave on the South African coast, people ground red ochre and engraved patterns into it. They strung shell beads. These were signs that stood for something, an early flicker of symbolic thought.",
    brainSignificance:
      'Using colour and pattern to stand for identity or ideas needs a mind that links an object to a meaning beyond itself. Symbolism is the foundation of art, ritual and eventually writing.',
    details:
      "Blombos yielded an ochre-processing kit about 100,000 years old, ochre engraved with a crosshatch pattern from about 75,000 years ago, and a drawing in ochre crayon on stone about 73,000 years old.",
    image: {
      src: '/media/ochre-symbolic-thought.svg',
      alt: 'Piece of red ochre engraved with a crosshatch pattern',
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
      "Language is hard to find in fossils, but it left clues. The gene FOXP2 helps control the fine movements of speech. With words and grammar, minds could share plans, stories and memories.",
    brainSignificance:
      'Language lets one mind pass its thoughts to another, so knowledge could accumulate across generations. It rests on networks that link the left frontal and temporal cortex with the basal ganglia and cerebellum. FOXP2 is one contributor, not a single language gene.',
    details:
      "Neanderthals carried the same FOXP2 variant, and a 2018 study found no sign of a recent selective sweep at the gene in living humans, so it cannot date the origin of speech.",
    image: {
      src: '/media/language-foxp2.svg',
      alt: 'Brain outline with language areas and a DNA strand highlighted',
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
      "Around 60,000 years ago, groups of modern humans left Africa for good. They crossed deserts, mountains and seas. Their flexible, social brains carried them to every continent but Antarctica.",
    brainSignificance:
      'Settling deserts, ice-age tundra and open sea demanded flexible planning, cooperation and cultural learning. Our large, adaptable brains, not new anatomy, let one species occupy nearly every habitat on Earth.',
    details:
      'Along the way sapiens met and interbred with Neanderthals and Denisovans, and most people today carry a small share of their DNA.',
    image: {
      src: '/media/out-of-africa.svg',
      alt: 'World map with arrows spreading outward from Africa',
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
      "By torchlight, people painted animals on cave walls and pressed their hands against the stone. Each image began as a picture in the mind. Art made the inner world visible to others.",
    brainSignificance:
      'A painted pig or bison on a wall means the artist could hold a mental image, plan it, and expect others to understand it. It shows imagination, visual memory and shared meaning at work.',
    details:
      "A scene of human-like figures and a pig on Sulawesi is at least 51,200 years old, the oldest known figurative art. The paintings at Chauvet are about 36,000 years old and those at Lascaux about 17,000.",
    image: {
      src: '/media/cave-art.svg',
      alt: 'Painted bison and hand stencils on a cave wall',
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
      "In caves in Germany, people carved flutes from bird bone and ivory. Music lights up many parts of the brain at once. It may have helped early communities bond and share feelings.",
    brainSignificance:
      'Music engages auditory, motor, memory and reward circuits together. It binds groups through shared rhythm and emotion, and it probably strengthened social bonds long before written words.',
    image: {
      src: '/media/bone-flutes-music.svg',
      alt: 'Bone flute with finger holes carved from a vulture wing bone',
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
    yearLabel: "~34,000 years ago",
    era: 'sapiens',
    title: 'Burial and Ritual',
    summary:
      "People had been burying their dead for at least 100,000 years. At Sunghir they dressed them in thousands of ivory beads. Somewhere along the way, a brain looked at someone it loved, now still, and asked: where did they go?",
    brainSignificance:
      'Burying the dead suggests an understanding of death, grief and perhaps an afterlife. It reflects the capacity to imagine what cannot be seen and to share that belief with a community.',
    image: {
      src: '/media/burial-ritual.svg',
      alt: 'Grave with a skeleton surrounded by beads and ochre',
    },
    tags: ['burial', 'ritual', 'death', 'Qafzeh'],
    sources: [
      { label: "Sikora et al. (2017). Ancient genomes show social and reproductive behavior of early Upper Paleolithic foragers. Science", url: "https://doi.org/10.1126/science.aao1807" },
      { label: "Martinón-Torres et al. (2021). Earliest known human burial in Africa. Nature", url: "https://doi.org/10.1038/s41586-021-03457-8" },
      { label: "Grün et al. (2005). U-series and ESR analyses of bones and teeth relating to the human burials from Skhul. Journal of Human Evolution", url: "https://doi.org/10.1016/j.jhevol.2005.04.006" },
      { label: "Smithsonian Human Origins Program. Qafzeh: oldest intentional burial", url: "https://humanorigins.si.edu/evidence/behavior/qafzeh-oldest-intentional-burial" },
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
      "Tools became finer and more varied. People sewed clothing, traded over long distances and wore ornaments. Culture itself became cumulative, as each generation built on what the last had learned.",
    brainSignificance:
      'Innovations began to pile up and be passed on rather than lost. This ratchet of cumulative culture, powered by teaching, language and large social groups, made culture a force as important as genes.',
    details:
      'Many of these traits appear in Africa much earlier, so behavioural modernity looks more like a gradual build-up than a sudden revolution.',
    image: {
      src: '/media/behavioural-modernity.svg',
      alt: 'Display of stone blades, a bone needle and shell ornaments',
    },
    tags: ['cumulative culture', 'toolkits', 'trade'],
    sources: [
      { label: "McBrearty & Brooks (2000). The revolution that wasn’t: a new interpretation of the origin of modern human behavior. Journal of Human Evolution", url: "https://doi.org/10.1006/jhev.2000.0435" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'gobekli-tepe',
    yearsAgo: 11_500,
    yearLabel: '~11,500 years ago',
    era: 'sapiens',
    title: 'Minds in Everything',
    summary:
      "About 11,500 years ago, hunter-gatherers raised giant carved pillars at G\u00f6bekli Tepe. Was it a temple? Archaeologists still debate it. A brain built to read minds senses them everywhere: in animals, storms and stars. Many scientists see that as one root of religion.",
    brainSignificance:
      "The machinery that lets us guess what others intend also leaps to see intent where there may be none: a rustle becomes a predator, thunder becomes anger. Researchers call this agency detection, and many see it, together with our ability to model minds, as one source of belief in gods and spirits. That explains why belief comes naturally; it does not settle what is true.",
    details:
      "The enclosures of G\u00f6bekli Tepe, in south-eastern Turkey, were built before farming, by people who still hunted and gathered. Their T-shaped pillars, some over five metres tall, are carved with foxes, boars, snakes and vultures. The excavators saw ritual gathering places; others argue they were richly decorated houses.",
    tags: ['Göbekli Tepe', 'religion', 'agency detection', 'theory of mind'],
    sources: [
      { label: "Dietrich et al. (2012). The role of cult and feasting in the emergence of Neolithic communities: new evidence from Göbekli Tepe. Antiquity", url: "https://doi.org/10.1017/s0003598x00047840" },
      { label: "Banning (2011). So fair a house: Göbekli Tepe and the identification of temples in the Pre-Pottery Neolithic of the Near East. Current Anthropology", url: "https://doi.org/10.1086/661207" },
      { label: "Barrett (2000). Exploring the natural foundations of religion. Trends in Cognitive Sciences", url: "https://doi.org/10.1016/s1364-6613(99)01419-9" },
      { label: "Guthrie (1993). Faces in the Clouds: A New Theory of Religion. Oxford University Press", url: "https://doi.org/10.1093/oso/9780195069013.001.0001" },
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
      "About 11,000 years ago, people began to sow grain and keep animals. Villages and towns followed. Life in bigger groups called for counting, planning and trust among many people.",
    brainSignificance:
      "Settled life created larger societies, surplus food and specialised roles. It put new demands on memory, planning, numeracy and cooperation among strangers. Human brains are slightly smaller now than in the late Ice Age; when that happened, and why, is debated.",
    image: {
      src: '/media/agriculture.svg',
      alt: 'Hands sowing wheat seeds beside a mud-brick village',
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
      "Around 5,200 years ago, scribes in Sumer pressed marks into clay. Reading repurposes parts of the visual brain that evolved for other tasks. Writing gave humanity a memory beyond any single mind.",
    brainSignificance:
      'Reading is far too recent to have shaped a dedicated brain region through evolution. Instead, learning to read recycles visual areas of the left occipitotemporal cortex. Writing extended memory outside the skull.',
    details:
      "Egyptian hieroglyphs appeared at about the same time; Chinese and Mesoamerican scripts arose later and independently.",
    image: {
      src: '/media/writing.svg',
      alt: 'Clay tablet with cuneiform wedge marks',
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
      "Alphabets trimmed writing down to a few dozen letters, each standing for a sound. That made reading far easier to learn. More minds could now take part in the written world.",
    brainSignificance:
      'A few dozen symbols replaced hundreds, so reading became far easier to learn. Mapping letters to speech sounds links visual and language networks, and it opened literacy to far more people.',
    image: {
      src: '/media/alphabet.svg',
      alt: 'Early alphabetic letters inscribed on a stone fragment',
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
      "Ancient thinkers began to ask what the mind is and where it lives. Hippocrates declared that the brain is the source of joy and sorrow. The brain had started to study itself.",
    brainSignificance:
      'For the first time the brain turned to study itself. Hippocrates wrote that from the brain come our pleasures, joys, laughter and sorrows. Later, Galen showed through dissection that nerves lead to the brain.',
    image: {
      src: '/media/philosophy-of-mind.svg',
      alt: 'Bust of a Greek philosopher beside a sketch of the brain',
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
      "Around 1440, Gutenberg built a press with movable type. Books became cheap and ideas spread widely. Human knowledge could now accumulate and be questioned at a much larger scale.",
    brainSignificance:
      'Ideas could now travel faster than any single person and be checked by many. Mass literacy and the spread of knowledge became an engine of collective intelligence.',
    image: {
      src: '/media/printing-press.svg',
      alt: 'Wooden printing press with trays of metal type',
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
      "In the sixteenth and seventeenth centuries, anatomists drew the brain with new accuracy. Thomas Willis tied brain structures to behaviour. Observation and experiment were becoming the tools for understanding the mind.",
    brainSignificance:
      'Thomas Willis mapped the brain and its blood supply in 1664 and linked brain regions to behaviour. The mind began to be explained through observation and experiment rather than doctrine alone.',
    details:
      'Descartes separated mind from body, a puzzle that neuroscience and philosophy are still working on.',
    image: {
      src: '/media/scientific-revolution.svg',
      alt: 'Anatomical engraving of the brain from the 1500s',
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
      "Broca and Wernicke linked speech to specific regions of the cortex. Then Cajal looked through his microscope and drew the neurons themselves. The brain, he showed, is a network of separate cells.",
    brainSignificance:
      'Broca and Wernicke proved that functions occupy particular places in the cortex. Cajal, using Golgi stains, showed that neurons are individual cells that communicate across gaps, the foundation of modern neuroscience. He shared the 1906 Nobel Prize with Camillo Golgi.',
    image: {
      src: '/media/neuron-doctrine.svg',
      alt: 'Cajal-style ink drawing of branching neurons',
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
      "In 1929, Hans Berger recorded electrical rhythms from the human scalp. Brain waves could now be watched in a living person. They revealed the patterns of sleep, attention and seizures.",
    brainSignificance:
      'For the first time scientists could watch a living brain at work without opening the skull. Brain waves became a window into sleep, attention, epilepsy and consciousness.',
    image: {
      src: '/media/eeg.svg',
      alt: 'Scalp electrodes and a trace of brain waves',
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
      "Functional MRI follows blood flow to reveal which parts of the brain are busy. It lets us see thinking, remembering and feeling in healthy people. Entire networks of the brain came into view.",
    brainSignificance:
      'fMRI let researchers map networks for vision, memory, emotion and language in healthy people. Its measure is indirect and slow compared with neural firing, but it transformed cognitive neuroscience.',
    image: {
      src: '/media/fmri.svg',
      alt: 'Brain scan with coloured patches of activity',
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
      "Tiny electrode arrays can now read movement and speech intentions from the cortex. People with paralysis have controlled cursors, robot arms and voice synthesisers by thought alone. The brain is learning to speak directly to machines.",
    brainSignificance:
      'Decoding intentions from neural activity shows that the brain\'s signals can be read and used, and that it can learn to control new devices. This opens paths to restoring movement and communication.',
    image: {
      src: '/media/brain-computer-interfaces.svg',
      alt: 'Electrode array on the cortex connected to a robotic arm',
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
      "In 2012, a neural network loosely inspired by the brain learned to recognise objects in photos far better than any program before it. Machines began to learn from examples, a little like brains do, and became a mirror for studying our own minds.",
    brainSignificance:
      'These systems differ greatly from real brains in design, energy use and learning, yet comparing them sharpens questions about what intelligence, understanding and consciousness really are. Machines now serve as models, and as a mirror, for the mind.',
    image: {
      src: '/media/ai-mirror.svg',
      alt: 'Network of connected nodes overlaid on a human head profile',
    },
    tags: ['artificial intelligence', 'neural networks', 'deep learning'],
    sources: [
      { label: "Krizhevsky, Sutskever & Hinton (2017). ImageNet classification with deep convolutional neural networks. Communications of the ACM", url: "https://doi.org/10.1145/3065386" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'machines-learn-language',
    yearsAgo: 6,
    yearLabel: '2017 to 2022 CE',
    era: 'modern',
    title: 'Machines Learn Our Language',
    summary:
      "In 2017, a new kind of neural network appeared: the transformer. Trained on vast amounts of human writing, its descendants learned to use language with startling fluency. For the first time, something other than a person could talk back. Is anyone home inside? Nobody knows.",
    brainSignificance:
      "Language was the fifth breakthrough, the one that let human brains pool what they knew. Language models learn it very differently, from far more text than a person could read in thousands of lifetimes, and how much they understand is still debated.",
    tags: ['language models', 'transformer', 'artificial intelligence'],
    sources: [
      { label: "Vaswani et al. (2017). Attention is all you need. NeurIPS (arXiv:1706.03762)", url: "https://arxiv.org/abs/1706.03762" },
      { label: "Brown et al. (2020). Language models are few-shot learners. NeurIPS (arXiv:2005.14165)", url: "https://arxiv.org/abs/2005.14165" },
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
      "Here we are: a brain of 86 billion neurons, running on 20 watts, looking back over its own history. Now it shares the world with machines that learn. What happens next is up to us. Look into the mirror: there it is.",
    brainSignificance:
      'The human brain holds about 86 billion neurons and uses about 20 watts. It is the product of a long, unplanned history, and the story is still being written, now in part by us.',
    brainVolumeCc: 1350,
    image: {
      src: '/media/now.svg',
      alt: 'Human silhouette looking toward a star-filled horizon',
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
      "Until language, imagined scenes stayed inside one head. With words, a person can place a plan, a memory or a place in another mind. Language lets many brains work as one.",
    brainSignificance:
      'Simulation was once private; speech made it shareable. Combined with mentalizing, language lets groups plan together, pass on knowledge and agree on shared fictions, and it allows learned symbols to outlast any individual.',
    details:
      'Chimpanzees and bonobos can learn some symbols, but nothing like open-ended grammar. Whether language emerged gradually or in a late step is unresolved.',
    image: {
      src: '/media/language-shares-simulations.svg',
      alt: 'Two humans at a fire, one speaking, with a glowing scene appearing in the listener thought bubble',
    },
    tags: ['language','symbols','shared simulation','communication'],
    sources: [
      { label: "Hauser, Chomsky & Fitch (2002). The faculty of language: what is it, who has it, and how did it evolve? Science", url: "https://doi.org/10.1126/science.298.5598.1569" },
    ],
  },
];
