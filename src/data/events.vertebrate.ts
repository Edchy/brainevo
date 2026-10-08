import type { TimelineEvent } from '../types';

export const nervesVertebrateEvents: TimelineEvent[] = [
  {
    id: 'first-neurons-nerve-net',
    yearsAgo: 600_000_000,
    yearLabel: '~600 million years ago',
    era: 'nerves',
    title: 'First Neurons and the Nerve Net',
    summary:
      'In early animals such as the ancestors of jellyfish and sea anemones, specialized cells appeared that conduct electrical signals and release chemical messengers. Cnidarians still show the result: a diffuse nerve net with no brain.',
    brainSignificance:
      'Neurons let one part of an animal rapidly coordinate with another, linking sensing to movement far faster than chemical diffusion. A nerve net spreads signals in all directions and supports simple behaviors such as contraction, feeding and withdrawal. Whether neurons arose once or twice (ctenophores may have evolved them independently) remains debated.',
    details:
      'Sponges lack neurons, yet they share many of the genes later used in synapses. This suggests the molecular toolkit for neural signaling existed before true nervous systems.',
    image: {
      src: '/media/first-neurons-nerve-net.svg',
      alt: 'Illustration of a jellyfish with a web-like net of neurons spread through its body',
    },
    audio: {
      src: '/media/first-neurons-nerve-net.mp3',
      transcript:
        'Around six hundred million years ago, some animals began to use cells that carry electrical signals. In jellyfish and sea anemones this takes the form of a nerve net, a web of neurons with no central command. It was the first step toward every brain that followed.',
    },
    tags: ['neuron', 'nerve net', 'cnidarian', 'synapse'],
  },
  {
    breakthrough: 'steering',
    id: 'bilateral-symmetry-ganglia',
    yearsAgo: 570_000_000,
    yearLabel: '~570 million years ago',
    era: 'nerves',
    title: 'Bilateral Symmetry and Ganglia',
    summary:
      'The bilaterians, animals with a left and right side and a front and back, evolved from radially symmetric ancestors. Many of them gathered neurons into clusters called ganglia and into longitudinal nerve cords.',
    brainSignificance:
      'Moving in one direction made the front end the place where new information arrives first. Concentrating neurons into ganglia shortened signal paths and allowed more complex processing than a diffuse net. This centralization is the basis of nearly all later nervous systems.',
    image: {
      src: '/media/bilateral-symmetry-ganglia.svg',
      alt: 'Diagram of a worm-like animal with paired nerve cords and clusters of neurons along its body',
    },
    audio: {
      src: '/media/bilateral-symmetry-ganglia.mp3',
      transcript:
        'Animals that crawl or swim in one direction developed a head end and a tail end, with matching left and right sides. Their neurons began to gather into clusters called ganglia, connected by nerve cords. Centralizing the nervous system made faster and smarter responses possible.',
    },
    tags: ['bilateria', 'ganglia', 'nerve cord', 'centralization'],
  },
  {
    breakthrough: 'steering',
    id: 'cephalization',
    yearsAgo: 555_000_000,
    yearLabel: '~555 million years ago',
    era: 'nerves',
    title: 'Cephalization: The First Heads',
    summary:
      'In many bilaterian lineages, sense organs and neurons became concentrated at the leading end of the body, forming a head with an anterior brain. Flatworms are a living example, with a cerebral ganglion and sensory structures at the front.',
    brainSignificance:
      'A head brings together chemical sensors, light detectors and a processing center right where the animal meets new surroundings. The anterior ganglion became a true brain, integrating sensory input and steering the body. Cephalization began a trend toward larger, more specialized brains.',
    image: {
      src: '/media/cephalization.svg',
      alt: 'Flatworm with a highlighted cluster of neurons and eyespots at its head end',
    },
    audio: {
      src: '/media/cephalization.mp3',
      transcript:
        'As animals moved forward through the world, their senses and neurons piled up at the front. This process is called cephalization, and it created the first heads. The cluster of neurons in a head is what we now call a brain.',
    },
    tags: ['cephalization', 'head', 'flatworm', 'sensory organs'],
  },
  {
    breakthrough: 'steering',
    id: 'cambrian-explosion-eyes',
    yearsAgo: 540_000_000,
    yearLabel: '~540 million years ago',
    era: 'nerves',
    title: 'The Cambrian Explosion and the Rise of Eyes',
    summary:
      'Within roughly 20 million years, most major animal body plans appear in the fossil record. Image-forming eyes evolved in several groups, including arthropods such as trilobites, and predation became a driving force.',
    brainSignificance:
      'Vision supplies rich, rapid information about distance, motion and shape, and processing it demands larger and more elaborate brains. An arms race of predators and prey rewarded better senses, faster reactions and learning. The Cambrian is when complex, sensory-driven brains became widespread.',
    details:
      'Eyes evolved independently many times, although they share ancient light-sensing opsin proteins and some developmental genes such as Pax6.',
    image: {
      src: '/media/cambrian-explosion-eyes.svg',
      alt: 'Cambrian seafloor scene with a trilobite and a predator, showing compound eyes',
    },
    audio: {
      src: '/media/cambrian-explosion-eyes.mp3',
      transcript:
        'About five hundred and forty million years ago, animal life diversified dramatically in the Cambrian explosion. Many animals evolved eyes, and the race between hunters and hunted favored sharper senses. Processing all that visual information pushed brains to become more complex.',
    },
    tags: ['Cambrian', 'eyes', 'vision', 'predation', 'trilobite'],
  },
  {
    breakthrough: 'steering',
    id: 'chordates-notochord-nerve-cord',
    yearsAgo: 530_000_000,
    yearLabel: '~530 million years ago',
    era: 'vertebrate',
    title: 'Chordates: Notochord and Dorsal Nerve Cord',
    summary:
      'Early chordates, such as the fossil Pikaia and small relatives of today\'s lancelets, had a flexible notochord and a hollow nerve cord running along the back. Unlike the solid, ventral nerve cords of many invertebrates, theirs formed from a folded neural tube.',
    brainSignificance:
      'The hollow dorsal nerve cord is the ancestor of the vertebrate spinal cord and brain. A stiff notochord allowed strong, wave-like swimming that demanded precise motor coordination along the body. In lancelets, a swelling at the front end of the cord hints at a rudimentary brain.',
    image: {
      src: '/media/chordates-notochord-nerve-cord.svg',
      alt: 'Cross-section of a lancelet showing the notochord below a hollow dorsal nerve cord',
    },
    audio: {
      src: '/media/chordates-notochord-nerve-cord.mp3',
      transcript:
        'Chordates added a stiff rod called the notochord and a hollow nerve cord along the back. That nerve cord is the forerunner of our spinal cord and brain. It also helped these animals swim with coordinated, wave-like movements.',
    },
    tags: ['chordate', 'notochord', 'neural tube', 'lancelet', 'Pikaia'],
  },
  {
    breakthrough: 'reinforcing',
    id: 'first-vertebrates-neural-crest',
    yearsAgo: 520_000_000,
    yearLabel: '~520 million years ago',
    era: 'vertebrate',
    title: 'The First Vertebrates',
    summary:
      'Small, jawless fishlike animals such as Haikouichthys and Myllokunmingia appear in Chinese Cambrian fossils. They had a skull-like braincase, paired eyes and a distinct head.',
    brainSignificance:
      'Vertebrates evolved neural crest cells and sensory placodes, embryonic tissues that build sensory organs, cranial nerves and parts of the head. These allowed a larger, more complex brain protected by cartilage. Whole-genome duplications in early vertebrates also supplied extra genes for neural development.',
    image: {
      src: '/media/first-vertebrates-neural-crest.svg',
      alt: 'Reconstruction of a small jawless Cambrian fish with visible eyes and a head',
    },
    audio: {
      src: '/media/first-vertebrates-neural-crest.mp3',
      transcript:
        'Around five hundred and twenty million years ago, the first true vertebrates swam in Cambrian seas. They had a head with paired eyes and a protective braincase, built by new embryonic cells called the neural crest. These innovations let the brain grow more complex.',
    },
    tags: ['vertebrate', 'neural crest', 'placodes', 'Haikouichthys'],
  },
  {
    breakthrough: 'reinforcing',
    id: 'tripartite-brain',
    yearsAgo: 500_000_000,
    yearLabel: '~500 million years ago',
    era: 'vertebrate',
    title: 'The Tripartite Brain',
    summary:
      'The vertebrate brain organized into three regions: the forebrain (prosencephalon), midbrain (mesencephalon) and hindbrain (rhombencephalon). This plan is seen in every vertebrate embryo today.',
    brainSignificance:
      'The forebrain handles smell and, later, higher integration; the midbrain processes vision and hearing; the hindbrain controls breathing, balance and basic body functions. Dividing the brain into modules let each region specialize and expand independently. The basic division persists in the human brain.',
    image: {
      src: '/media/tripartite-brain.svg',
      alt: 'Side view of a simple fish brain with forebrain, midbrain and hindbrain labeled in three colors',
    },
    audio: {
      src: '/media/tripartite-brain.mp3',
      transcript:
        'Early vertebrates organized their brains into three parts: the forebrain, the midbrain and the hindbrain. Each part took on different jobs, from smell and vision to balance and breathing. Your own brain still follows this ancient three-part plan.',
    },
    tags: ['forebrain', 'midbrain', 'hindbrain', 'brain regionalization'],
  },
  {
    breakthrough: 'reinforcing',
    id: 'lampreys-brain-and-cerebellum',
    yearsAgo: 480_000_000,
    yearLabel: '~480 million years ago',
    era: 'vertebrate',
    title: 'Lampreys, a Cerebellum and Image-Forming Eyes',
    summary:
      'Jawless fishes such as ancestors of modern lampreys and hagfish show the early vertebrate brain. Lampreys have a camera-type eye, a retina and optic tectum, and a small cerebellum-like region in the hindbrain.',
    brainSignificance:
      'The cerebellum fine-tunes movement and balance by comparing intended and actual motion, which matters for active swimming. It is small in lampreys and much larger in jawed fishes. Lampreys also show the basic vertebrate layout of pallium, basal ganglia and tectum, which means this blueprint is older than the jaw.',
    image: {
      src: '/media/lampreys-brain-and-cerebellum.svg',
      alt: 'Lamprey with its brain highlighted, showing the cerebellum at the back',
    },
    audio: {
      src: '/media/lampreys-brain-and-cerebellum.mp3',
      transcript:
        'Lampreys are living jawless fishes that preserve a very old vertebrate brain design. They have a camera-style eye and a small cerebellum for coordinating movement. Studying them shows that the main vertebrate brain layout arose before jaws did.',
    },
    tags: ['lamprey', 'cerebellum', 'optic tectum', 'agnathan'],
  },
  {
    breakthrough: 'reinforcing',
    id: 'myelin-jawed-fish',
    yearsAgo: 430_000_000,
    yearLabel: '~430 million years ago',
    era: 'vertebrate',
    title: 'Jawed Fishes and Myelin',
    summary:
      'Jawed vertebrates (gnathostomes) arose, including placoderms, cartilaginous fishes and bony fishes. They also evolved myelin, a fatty insulating sheath around nerve axons made by glial cells.',
    brainSignificance:
      'Myelin allows nerve impulses to jump between gaps and travel many times faster, which supports quick reflexes in larger bodies and lets thin axons pack more densely. Active jawed predators drove larger brains and more elaborate sensory systems. Lampreys lack true myelin, so it is a gnathostome innovation.',
    image: {
      src: '/media/myelin-jawed-fish.svg',
      alt: 'Early jawed fish beside a close-up of an axon wrapped in a myelin sheath',
    },
    audio: {
      src: '/media/myelin-jawed-fish.mp3',
      transcript:
        'Jawed fishes appeared and spread, and with them came myelin, a fatty wrapping around nerve fibers. Myelin makes signals travel much faster and more efficiently. Fast nerves were a big advantage for large, active predators.',
    },
    tags: ['myelin', 'gnathostome', 'glia', 'saltatory conduction'],
  },
  {
    breakthrough: 'reinforcing',
    id: 'pallium-fish-forebrain',
    yearsAgo: 420_000_000,
    yearLabel: '~420 million years ago',
    era: 'vertebrate',
    title: 'The Pallium in the Fish Forebrain',
    summary:
      'In bony fishes, the forebrain develops by an unusual folding outward of the neural tube, called eversion, in ray-finned species. In all vertebrates the roof of the forebrain is called the pallium.',
    brainSignificance:
      'The pallium receives smell and other sensory input and handles learning and memory. In fish it has regions comparable to the hippocampus and amygdala of later animals. In mammals, part of the pallium expanded into the neocortex, so this region is the evolutionary seed of the cerebral cortex.',
    image: {
      src: '/media/pallium-fish-forebrain.svg',
      alt: 'Top view of a bony fish brain with the pallium region of the forebrain highlighted',
    },
    audio: {
      src: '/media/pallium-fish-forebrain.mp3',
      transcript:
        'The roof of the vertebrate forebrain is called the pallium. In fishes it handles smell, learning and memory. Much later, in mammals, a part of it would swell into the cerebral cortex.',
    },
    tags: ['pallium', 'forebrain', 'telencephalon', 'homology'],
  },
  {
    breakthrough: 'reinforcing',
    id: 'tetrapods-move-to-land',
    yearsAgo: 375_000_000,
    yearLabel: '~375 million years ago',
    era: 'vertebrate',
    title: 'Tetrapods Move onto Land',
    summary:
      'Lobe-finned fishes such as Tiktaalik, with sturdy fins, a neck and lungs, gave rise to the first four-limbed animals. Early amphibians like Ichthyostega lived at the water\'s edge and began to explore land.',
    brainSignificance:
      'Air offers clearer vision over long distances, different sounds and new smells, so the senses were retuned. Limbs required spinal and cerebellar circuits to coordinate weight-bearing walking, and the middle ear evolved from a fish bone to detect airborne sound. Amphibian brains remain relatively simple with a modest pallium.',
    image: {
      src: '/media/tetrapods-move-to-land.svg',
      alt: 'Tiktaalik crawling from shallow water onto a muddy shore',
    },
    audio: {
      src: '/media/tetrapods-move-to-land.mp3',
      transcript:
        'About three hundred and seventy-five million years ago, lobe-finned fishes like Tiktaalik began to crawl onto land. Life in air demanded new ways to see, hear and move. The nervous system adapted, with new circuits for walking and for hearing sound through air.',
    },
    tags: ['tetrapod', 'Tiktaalik', 'amphibian', 'limbs', 'middle ear'],
  },
  {
    breakthrough: 'reinforcing',
    id: 'amniotes-first-eggs',
    yearsAgo: 320_000_000,
    yearLabel: '~320 million years ago',
    era: 'vertebrate',
    title: 'Amniotes: Life Free from Water',
    summary:
      'The first amniotes, such as Hylonomus, laid eggs with a protective membrane and shell that could develop on dry land. The group soon split into the lineages leading to reptiles and birds and to mammals.',
    brainSignificance:
      'Independence from water allowed amniotes to occupy inland habitats and favored active, mobile lifestyles. The amniote forebrain enlarged, and the pallium became more organized, with layered regions receiving sensory input. This split carried two alternative paths: a dorsal cortex in reptiles and the origin of the six-layered neocortex in mammals.',
    image: {
      src: '/media/amniotes-first-eggs.svg',
      alt: 'Small lizard-like Hylonomus beside a shelled egg on dry ground',
    },
    audio: {
      src: '/media/amniotes-first-eggs.mp3',
      transcript:
        'Amniotes evolved eggs that could survive on land, freeing animals from needing water to reproduce. They spread across dry habitats and soon divided into the reptile and mammal lineages. Their forebrains began to develop the layered structures that would later become the cortex.',
    },
    tags: ['amniote', 'Hylonomus', 'amniotic egg', 'dorsal cortex'],
  },
  {
    breakthrough: 'reinforcing',
    id: 'reptile-brain-plan',
    yearsAgo: 309_000_000,
    yearLabel: '~310 million years ago',
    era: 'vertebrate',
    title: 'The Reptile Brain Plan',
    summary:
      'Early reptiles had a compact brain with a well-developed brainstem, cerebellum, optic tectum and basal ganglia, and a three-layered dorsal cortex. Living reptiles preserve a version of this arrangement.',
    brainSignificance:
      'Basal ganglia and brainstem circuits support habits, movement, aggression, feeding and territorial behavior. The popular idea of a separate "reptilian brain" inside humans is a simplification, but these ancient structures do remain in our brains and keep performing similar roles. Reptiles also show learning, spatial memory and complex behaviors, so their brains are not merely primitive.',
    image: {
      src: '/media/reptile-brain-plan.svg',
      alt: 'Lizard brain diagram with brainstem, cerebellum, optic tectum, basal ganglia and dorsal cortex labeled',
    },
    audio: {
      src: '/media/reptile-brain-plan.mp3',
      transcript:
        'Reptiles evolved a compact brain with strong brainstem, midbrain and basal ganglia circuits for movement, habit and survival. A thin layered cortex sat on top. These ancient structures are still present in the human brain, though modern research shows reptile brains are more capable than once believed.',
    },
    tags: ['reptile', 'basal ganglia', 'brainstem', 'dorsal cortex', 'triune brain'],
  },
  {
    breakthrough: 'reinforcing',
    id: 'dopamine-reinforcement-signal',
    yearsAgo: 495_000_000,
    yearLabel: '~500 million years ago (inferred)',
    era: 'vertebrate',
    title: 'Dopamine as a Learning Signal',
    summary:
      'Early vertebrates used dopamine neurons to signal not simply reward but surprise about reward: whether an outcome was better or worse than expected. Dopamine systems are conserved from lampreys to mammals, which is why the date is inferred from living species.',
    brainSignificance:
      'This resembles the prediction error of temporal-difference learning in computer science. Instead of waiting for a final outcome, an animal can learn from each step that predicts a good or bad result. Trial-and-error learning became practical for animals with long chains of actions.',
    details:
      'Recordings in monkeys by Wolfram Schultz and colleagues, and the modeling work of Peter Dayan, Read Montague and others, linked dopamine firing to this error signal. It is a powerful account, though dopamine also has other roles in motivation and movement.',
    image: {
      src: '/media/dopamine-reinforcement-signal.svg',
      alt: 'Illustration of a neuron releasing dopamine, with a glowing pulse when a reward is better than predicted',
    },
    audio: {
      src: '/media/dopamine-reinforcement-signal.mp3',
      transcript:
        'Early in vertebrate history, neurons that release dopamine took on a special job. They fire when things turn out better than expected and fall silent when worse. That teaching signal lets an animal learn which actions lead to good outcomes.',
    },
    tags: ['dopamine','prediction error','temporal difference','reinforcement learning'],
  },
  {
    breakthrough: 'reinforcing',
    id: 'basal-ganglia-actor-critic',
    yearsAgo: 470_000_000,
    yearLabel: '~470 million years ago (inferred)',
    era: 'vertebrate',
    title: 'Basal Ganglia: Actor and Critic',
    summary:
      'The basal ganglia, a set of deep forebrain structures, select which action an animal performs and are reshaped by dopamine. A basal ganglia circuit is present in lampreys, so its core design is very old.',
    brainSignificance:
      'Many researchers describe this system in terms of an actor that chooses actions and a critic that predicts value, a framing borrowed from reinforcement learning. Dopamine teaches both. The result is an animal that repeats what worked and drops what did not.',
    details:
      'This actor-critic reading is a model, not a settled anatomical fact, and the mapping onto brain regions is still debated. Work by Sten Grillner and colleagues on the lamprey supports deep conservation of the circuit.',
    image: {
      src: '/media/basal-ganglia-actor-critic.svg',
      alt: 'Diagram of a lamprey brain with the basal ganglia highlighted and arrows labeled choose and evaluate',
    },
    audio: {
      src: '/media/basal-ganglia-actor-critic.mp3',
      transcript:
        'Deep in the forebrain, the basal ganglia pick the next action. Dopamine adjusts how strongly each choice is favored, based on how well it turned out. Scientists often compare this to an actor choosing and a critic judging, and the circuit appears in lampreys.',
    },
    tags: ['basal ganglia','actor-critic','action selection','lamprey'],
  },
];
