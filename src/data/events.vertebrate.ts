import type { TimelineEvent } from '../types';

export const nervesVertebrateEvents: TimelineEvent[] = [
  {
    id: 'first-neurons-nerve-net',
    yearsAgo: 600_000_000,
    yearLabel: '~600 million years ago',
    era: 'nerves',
    title: 'First Neurons and the Nerve Net',
    summary:
      "Around 600 million years ago, some animals began using cells that carry electrical signals. In jellyfish and sea anemones they form a nerve net, a web of neurons with no central command: the first step toward every brain that followed.",
    brainSignificance:
      'Neurons let one part of an animal rapidly coordinate with another, linking sensing to movement far faster than chemical diffusion. A nerve net spreads signals in all directions and supports simple behaviors such as contraction, feeding and withdrawal. Whether neurons arose once or twice (ctenophores may have evolved them independently) remains debated.',
    details:
      "Sponges lack neurons, yet they share many of the genes later used in synapses, so the molecular toolkit for neural signalling existed before true nervous systems. In 2023 the nerve net of a comb jelly turned out to be one fused web of cells rather than separate neurons.",
    image: {
      src: '/media/first-neurons-nerve-net.svg',
      alt: 'Illustration of a jellyfish with a web-like net of neurons spread through its body',
    },
    tags: ['neuron', 'nerve net', 'cnidarian', 'synapse'],
    sources: [
      { label: "Burkhardt et al. (2023). Syncytial nerve net in a ctenophore adds insights on the evolution of nervous systems. Science", url: "https://doi.org/10.1126/science.ade5645" },
    ],
  },
  {
    breakthrough: 'steering',
    id: 'bilateral-symmetry-ganglia',
    yearsAgo: 570_000_000,
    yearLabel: '~570 million years ago',
    era: 'nerves',
    title: 'Bilateral Symmetry and Ganglia',
    summary:
      "Animals that crawl or swim in one direction developed a head end and a tail end, with matching left and right sides. Their neurons began to gather into clusters called ganglia, connected by nerve cords. Centralizing the nervous system made faster and smarter responses possible.",
    brainSignificance:
      'Moving in one direction made the front end the place where new information arrives first. Concentrating neurons into ganglia shortened signal paths and allowed more complex processing than a diffuse net. This centralization is the basis of nearly all later nervous systems.',
    details:
      "The oldest bilaterian fossil yet named, the grain-of-rice-sized Ikaria wariootia from South Australia, is about 555 million years old; molecular clocks suggest the group is older.",
    image: {
      src: '/media/bilateral-symmetry-ganglia.svg',
      alt: 'Diagram of a worm-like animal with paired nerve cords and clusters of neurons along its body',
    },
    tags: ['bilateria', 'ganglia', 'nerve cord', 'centralization'],
    sources: [
      { label: "Evans et al. (2020). Discovery of the oldest bilaterian from the Ediacaran of South Australia. PNAS", url: "https://doi.org/10.1073/pnas.2001045117" },
      { label: "Bennett (2023). A Brief History of Intelligence. Mariner Books", url: "https://www.hachettebookgroup.com/titles/max-bennett/a-brief-history-of-intelligence/9780063286375/" },
    ],
  },
  {
    breakthrough: 'steering',
    id: 'cephalization',
    yearsAgo: 555_000_000,
    yearLabel: '~555 million years ago',
    era: 'nerves',
    title: 'Cephalization: The First Heads',
    summary:
      "As animals moved forward through the world, their senses and neurons piled up at the front. This process is called cephalization, and it created the first heads. The cluster of neurons in a head is what we now call a brain.",
    brainSignificance:
      'A head brings together chemical sensors, light detectors and a processing center right where the animal meets new surroundings. The anterior ganglion became a true brain, integrating sensory input and steering the body. Cephalization began a trend toward larger, more specialized brains.',
    details:
      "Whether the very first bilaterians already had a brain, or only a simpler net that later centralised in several lineages, is still debated.",
    image: {
      src: '/media/cephalization.svg',
      alt: 'Flatworm with a highlighted cluster of neurons and eyespots at its head end',
    },
    tags: ['cephalization', 'head', 'flatworm', 'sensory organs'],
    sources: [
      { label: "Arendt et al. (2008). The evolution of nervous system centralization. Philosophical Transactions of the Royal Society B", url: "https://doi.org/10.1098/rstb.2007.2242" },
    ],
  },
  {
    breakthrough: 'steering',
    id: 'cambrian-explosion-eyes',
    yearsAgo: 539_000_000,
    yearLabel: "~539 million years ago",
    era: 'nerves',
    title: 'The Cambrian Explosion and the Rise of Eyes',
    summary:
      "About 540 million years ago, animal life diversified dramatically in the Cambrian explosion. Many animals evolved eyes, and the race between hunters and hunted favored sharper senses. Processing all that visual information pushed brains to become more complex.",
    brainSignificance:
      'Vision supplies rich, rapid information about distance, motion and shape, and processing it demands larger and more elaborate brains. An arms race of predators and prey rewarded better senses, faster reactions and learning. The Cambrian is when complex, sensory-driven brains became widespread.',
    details:
      'Eyes evolved independently many times, although they share ancient light-sensing opsin proteins and some developmental genes such as Pax6.',
    image: {
      src: '/media/cambrian-explosion-eyes.svg',
      alt: 'Cambrian seafloor scene with a trilobite and a predator, showing compound eyes',
    },
    tags: ['Cambrian', 'eyes', 'vision', 'predation', 'trilobite'],
    sources: [
      { label: "Briggs (2015). The Cambrian explosion. Current Biology", url: "https://doi.org/10.1016/j.cub.2015.04.047" },
      { label: "International Commission on Stratigraphy. International Chronostratigraphic Chart", url: "https://stratigraphy.org/chart" },
    ],
  },
  {
    breakthrough: 'steering',
    id: 'chordates-notochord-nerve-cord',
    yearsAgo: 530_000_000,
    yearLabel: "~530 million years ago (inferred)",
    era: 'vertebrate',
    title: 'Chordates: Notochord and Dorsal Nerve Cord',
    summary:
      "Chordates added a stiff rod called the notochord and a hollow nerve cord along the back. That nerve cord is the forerunner of our spinal cord and brain. It also helped these animals swim with coordinated, wave-like movements.",
    brainSignificance:
      'The hollow dorsal nerve cord is the ancestor of the vertebrate spinal cord and brain. A stiff notochord allowed strong, wave-like swimming that demanded precise motor coordination along the body. In lancelets, a swelling at the front end of the cord hints at a rudimentary brain.',
    image: {
      src: '/media/chordates-notochord-nerve-cord.svg',
      alt: 'Cross-section of a lancelet showing the notochord below a hollow dorsal nerve cord',
    },
    tags: ['chordate', 'notochord', 'neural tube', 'lancelet', 'Pikaia'],
    sources: [
      { label: "Conway Morris & Caron (2012). Pikaia gracilens Walcott, a stem-group chordate from the Middle Cambrian of British Columbia. Biological Reviews", url: "https://doi.org/10.1111/j.1469-185x.2012.00220.x" },
    ],
  },
  {
    breakthrough: 'reinforcing',
    id: 'first-vertebrates-neural-crest',
    yearsAgo: 518_000_000,
    yearLabel: "~518 million years ago",
    era: 'vertebrate',
    title: 'The First Vertebrates',
    summary:
      "Around 520 million years ago, the first true vertebrates swam in Cambrian seas. They had a head with paired eyes and a protective braincase, built by new embryonic cells called the neural crest. These innovations let the brain grow more complex.",
    brainSignificance:
      'Vertebrates evolved neural crest cells and sensory placodes, embryonic tissues that build sensory organs, cranial nerves and parts of the head. These allowed a larger, more complex brain protected by cartilage. Whole-genome duplications in early vertebrates also supplied extra genes for neural development.',
    image: {
      src: '/media/first-vertebrates-neural-crest.svg',
      alt: 'Reconstruction of a small jawless Cambrian fish with visible eyes and a head',
    },
    tags: ['vertebrate', 'neural crest', 'placodes', 'Haikouichthys'],
    sources: [
      { label: "Shu et al. (1999). Lower Cambrian vertebrates from south China. Nature", url: "https://doi.org/10.1038/46965" },
    ],
  },
  {
    breakthrough: 'reinforcing',
    id: 'tripartite-brain',
    yearsAgo: 500_000_000,
    yearLabel: '~500 million years ago',
    era: 'vertebrate',
    title: 'The Tripartite Brain',
    summary:
      "Early vertebrates organized their brains into three parts: the forebrain, the midbrain and the hindbrain. Each part took on different jobs, from smell and vision to balance and breathing. Your own brain still follows this ancient three-part plan.",
    brainSignificance:
      'The forebrain handles smell and, later, higher integration; the midbrain processes vision and hearing; the hindbrain controls breathing, balance and basic body functions. Dividing the brain into modules let each region specialize and expand independently. The basic division persists in the human brain.',
    details:
      "Lampreys and hagfish show that this plan, and even finer subdivisions of the forebrain, were already present in the common ancestor of all living vertebrates.",
    image: {
      src: '/media/tripartite-brain.svg',
      alt: 'Side view of a simple fish brain with forebrain, midbrain and hindbrain labeled in three colors',
    },
    tags: ['forebrain', 'midbrain', 'hindbrain', 'brain regionalization'],
    sources: [
      { label: "Sugahara et al. (2016). Evidence from cyclostomes for complex regionalization of the ancestral vertebrate brain. Nature", url: "https://doi.org/10.1038/nature16518" },
    ],
  },
  {
    breakthrough: 'reinforcing',
    id: 'lampreys-brain-and-cerebellum',
    yearsAgo: 480_000_000,
    yearLabel: "~480 million years ago (inferred)",
    era: 'vertebrate',
    title: "Lampreys: Camera Eyes and an Old Brain Plan",
    summary:
      "Lampreys are living jawless fishes that preserve a very old vertebrate brain design. They have a camera-style eye and the same basic brain layout we have. Studying them shows that this plan arose before jaws did.",
    brainSignificance:
      "The cerebellum fine-tunes movement and balance by comparing intended and actual motion. It is tiny or absent in lampreys and well formed in jawed fishes. Lampreys also show the basic vertebrate layout of pallium, basal ganglia and tectum, which means this blueprint is older than the jaw.",
    image: {
      src: '/media/lampreys-brain-and-cerebellum.svg',
      alt: 'Lamprey with its brain highlighted, showing the cerebellum at the back',
    },
    tags: ['lamprey', 'cerebellum', 'optic tectum', 'agnathan'],
    sources: [
      { label: "Sugahara et al. (2016). Evidence from cyclostomes for complex regionalization of the ancestral vertebrate brain. Nature", url: "https://doi.org/10.1038/nature16518" },
      { label: "Grillner & Robertson (2016). The basal ganglia over 500 million years. Current Biology", url: "https://doi.org/10.1016/j.cub.2016.06.041" },
    ],
  },
  {
    breakthrough: 'reinforcing',
    id: 'myelin-jawed-fish',
    yearsAgo: 430_000_000,
    yearLabel: '~430 million years ago',
    era: 'vertebrate',
    title: 'Jawed Fishes and Myelin',
    summary:
      "Jawed fishes appeared and spread, and with them came myelin, a fatty wrapping around nerve fibers. Myelin makes signals travel much faster and more efficiently. Fast nerves were a big advantage for large, active predators.",
    brainSignificance:
      "Myelin lets nerve impulses leap from gap to gap along an axon and travel many times faster, which supports quick reflexes in larger bodies and lets thin axons pack more densely. Lampreys lack true myelin, so it is an innovation of jawed vertebrates.",
    details:
      "The oldest complete jawed fish fossils, from southern China, are about 436 million years old.",
    image: {
      src: '/media/myelin-jawed-fish.svg',
      alt: 'Early jawed fish beside a close-up of an axon wrapped in a myelin sheath',
    },
    tags: ['myelin', 'gnathostome', 'glia', 'saltatory conduction'],
    sources: [
      { label: "Zalc, Goujet & Colman (2008). The origin of the myelination program in vertebrates. Current Biology", url: "https://doi.org/10.1016/j.cub.2008.04.010" },
      { label: "Zhu et al. (2022). The oldest complete jawed vertebrates from the early Silurian of China. Nature", url: "https://doi.org/10.1038/s41586-022-05136-8" },
    ],
  },
  {
    breakthrough: 'reinforcing',
    id: 'pallium-fish-forebrain',
    yearsAgo: 420_000_000,
    yearLabel: '~420 million years ago',
    era: 'vertebrate',
    title: 'The Pallium in the Fish Forebrain',
    summary:
      "The roof of the vertebrate forebrain is called the pallium. In fishes it handles smell, learning and memory. Much later, in mammals, a part of it would swell into the cerebral cortex.",
    brainSignificance:
      'The pallium receives smell and other sensory input and handles learning and memory. In fish it has regions comparable to the hippocampus and amygdala of later animals. In mammals, part of the pallium expanded into the neocortex, so this region is the evolutionary seed of the cerebral cortex.',
    details:
      "The pallium itself is older than bony fishes: lampreys already have one. Lesion studies in goldfish separate a hippocampus-like region for spatial memory from an amygdala-like region for emotional learning.",
    image: {
      src: '/media/pallium-fish-forebrain.svg',
      alt: 'Top view of a bony fish brain with the pallium region of the forebrain highlighted',
    },
    tags: ['pallium', 'forebrain', 'telencephalon', 'homology'],
    sources: [
      { label: "Rodríguez et al. (2002). Spatial memory and hippocampal pallium through vertebrate evolution: insights from reptiles and teleost fish. Brain Research Bulletin", url: "https://doi.org/10.1016/s0361-9230(01)00682-7" },
    ],
  },
  {
    breakthrough: 'reinforcing',
    id: 'tetrapods-move-to-land',
    yearsAgo: 375_000_000,
    yearLabel: '~375 million years ago',
    era: 'vertebrate',
    title: 'Tetrapods Move onto Land',
    summary:
      "About 375 million years ago, fishes like Tiktaalik, with sturdy fins and lungs, were exploring the shallows, and their relatives became the first animals with four limbs. Life in air demanded new ways to see, hear and move.",
    brainSignificance:
      "Air offers clearer vision over long distances, different sounds and new smells, so the senses were retuned. Limbs required spinal and cerebellar circuits to coordinate weight-bearing walking, and a gill-support bone became the stapes of the middle ear. Amphibian brains remain relatively simple, with a modest pallium.",
    image: {
      src: '/media/tetrapods-move-to-land.svg',
      alt: 'Tiktaalik crawling from shallow water onto a muddy shore',
    },
    tags: ['tetrapod', 'Tiktaalik', 'amphibian', 'limbs', 'middle ear'],
    sources: [
      { label: "Daeschler, Shubin & Jenkins (2006). A Devonian tetrapod-like fish and the evolution of the tetrapod body plan. Nature", url: "https://doi.org/10.1038/nature04639" },
      { label: "Niedźwiedzki et al. (2010). Tetrapod trackways from the early Middle Devonian period of Poland. Nature", url: "https://doi.org/10.1038/nature08623" },
    ],
  },
  {
    breakthrough: 'reinforcing',
    id: 'amniotes-first-eggs',
    yearsAgo: 320_000_000,
    yearLabel: '~320 million years ago',
    era: 'vertebrate',
    title: 'Amniotes: Life Free from Water',
    summary:
      "Amniotes evolved eggs that could survive on land, freeing animals from needing water to reproduce. They spread across dry habitats and soon divided into the reptile and mammal lineages. Their forebrains began to develop the layered structures that would later become the cortex.",
    brainSignificance:
      'Independence from water allowed amniotes to occupy inland habitats and favored active, mobile lifestyles. The amniote forebrain enlarged, and the pallium became more organized, with layered regions receiving sensory input. This split carried two alternative paths: a dorsal cortex in reptiles and the origin of the six-layered neocortex in mammals.',
    image: {
      src: '/media/amniotes-first-eggs.svg',
      alt: 'Small lizard-like Hylonomus beside a shelled egg on dry ground',
    },
    tags: ['amniote', 'Hylonomus', 'amniotic egg', 'dorsal cortex'],
    sources: [
      { label: "Benton & Donoghue (2007). Paleontological evidence to date the tree of life. Molecular Biology and Evolution", url: "https://doi.org/10.1093/molbev/msl150" },
    ],
  },
  {
    breakthrough: 'reinforcing',
    id: 'reptile-brain-plan',
    yearsAgo: 309_000_000,
    yearLabel: '~310 million years ago',
    era: 'vertebrate',
    title: 'The Reptile Brain Plan',
    summary:
      "Reptiles evolved a compact brain with strong brainstem, midbrain and basal ganglia circuits for movement, habit and survival, under a thin layered cortex. We still carry these structures, and reptile brains turn out to be more capable than once believed.",
    brainSignificance:
      'Basal ganglia and brainstem circuits support habits, movement, aggression, feeding and territorial behavior. The popular idea of a separate "reptilian brain" inside humans is a simplification, but these ancient structures do remain in our brains and keep performing similar roles. Reptiles also show learning, spatial memory and complex behaviors, so their brains are not merely primitive.',
    image: {
      src: '/media/reptile-brain-plan.svg',
      alt: 'Lizard brain diagram with brainstem, cerebellum, optic tectum, basal ganglia and dorsal cortex labeled',
    },
    tags: ['reptile', 'basal ganglia', 'brainstem', 'dorsal cortex', 'triune brain'],
    sources: [
      { label: "Tosches et al. (2018). Evolution of pallium, hippocampus, and cortical cell types revealed by single-cell transcriptomics in reptiles. Science", url: "https://doi.org/10.1126/science.aar4237" },
    ],
  },
  {
    breakthrough: 'reinforcing',
    id: 'dopamine-reinforcement-signal',
    yearsAgo: 495_000_000,
    yearLabel: '~500 million years ago (inferred)',
    era: 'vertebrate',
    title: 'Dopamine as a Learning Signal',
    summary:
      "Early in vertebrate history, neurons that release dopamine took on a special job. They fire when things turn out better than expected and fall silent when worse. That teaching signal lets an animal learn which actions lead to good outcomes.",
    brainSignificance:
      'This resembles the prediction error of temporal-difference learning in computer science. Instead of waiting for a final outcome, an animal can learn from each step that predicts a good or bad result. Trial-and-error learning became practical for animals with long chains of actions.',
    details:
      'Recordings in monkeys by Wolfram Schultz and colleagues, and the modeling work of Peter Dayan, Read Montague and others, linked dopamine firing to this error signal. It is a powerful account, though dopamine also has other roles in motivation and movement.',
    image: {
      src: '/media/dopamine-reinforcement-signal.svg',
      alt: 'Illustration of a neuron releasing dopamine, with a glowing pulse when a reward is better than predicted',
    },
    tags: ['dopamine','prediction error','temporal difference','reinforcement learning'],
    sources: [
      { label: "Schultz, Dayan & Montague (1997). A neural substrate of prediction and reward. Science", url: "https://doi.org/10.1126/science.275.5306.1593" },
    ],
  },
  {
    breakthrough: 'reinforcing',
    id: 'basal-ganglia-actor-critic',
    yearsAgo: 470_000_000,
    yearLabel: '~470 million years ago (inferred)',
    era: 'vertebrate',
    title: 'Basal Ganglia: Actor and Critic',
    summary:
      "Deep in the forebrain, the basal ganglia pick the next action. Dopamine adjusts how strongly each choice is favored, based on how well it turned out. Scientists often compare this to an actor choosing and a critic judging, and the circuit appears in lampreys.",
    brainSignificance:
      'Many researchers describe this system in terms of an actor that chooses actions and a critic that predicts value, a framing borrowed from reinforcement learning. Dopamine teaches both. The result is an animal that repeats what worked and drops what did not.',
    details:
      'This actor-critic reading is a model, not a settled anatomical fact, and the mapping onto brain regions is still debated. Work by Sten Grillner and colleagues on the lamprey supports deep conservation of the circuit.',
    image: {
      src: '/media/basal-ganglia-actor-critic.svg',
      alt: 'Diagram of a lamprey brain with the basal ganglia highlighted and arrows labeled choose and evaluate',
    },
    tags: ['basal ganglia','actor-critic','action selection','lamprey'],
    sources: [
      { label: "Grillner & Robertson (2016). The basal ganglia over 500 million years. Current Biology", url: "https://doi.org/10.1016/j.cub.2016.06.041" },
    ],
  },
];
