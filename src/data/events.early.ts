import type { TimelineEvent } from '../types';

export const cosmicOriginEvents: TimelineEvent[] = [
  {
    id: 'big-bang',
    yearsAgo: 13_800_000_000,
    yearLabel: '13.8 billion years ago',
    era: 'cosmic',
    title: 'The Big Bang',
    summary:
      'The universe expands from an extremely hot, dense state, creating space, time, energy and, within minutes, the first hydrogen and helium nuclei.',
    brainSignificance:
      'No brain yet exists, but every atom of hydrogen in every neuron traces back to this moment. The physical laws that later allow chemistry, and so life and minds, are set here.',
    details:
      'About 380,000 years later the universe cooled enough for atoms to form and light to travel freely, leaving the cosmic microwave background we still detect today.',
    image: { src: '/media/big-bang.svg', alt: 'A bright point of light expanding outward into a field of cooling, glowing particles.' },
    audio: {
      src: '/media/big-bang.mp3',
      transcript:
        'Around 13.8 billion years ago, the universe began expanding from an unimaginably hot, dense state. Within minutes it had forged hydrogen and helium. Every hydrogen atom in your brain was made in that first moment.',
    },
    tags: ['Big Bang', 'hydrogen', 'cosmology'],
  },
  {
    id: 'first-stars-heavy-elements',
    yearsAgo: 13_500_000_000,
    yearLabel: '~13.5 billion years ago',
    era: 'cosmic',
    title: 'First Stars and Heavy Elements',
    summary:
      'The first stars ignite and fuse hydrogen and helium into carbon, oxygen, nitrogen, phosphorus and heavier elements, scattering them in supernovae.',
    brainSignificance:
      'Brains are built chiefly from carbon, hydrogen, oxygen, nitrogen and phosphorus, plus sodium, potassium, calcium and chlorine that neurons use to signal. All of these were forged in stars.',
    image: { src: '/media/first-stars-heavy-elements.svg', alt: 'A massive star exploding as a supernova, spraying colorful clouds of newly made elements.' },
    audio: {
      src: '/media/first-stars-heavy-elements.mp3',
      transcript:
        'Within a few hundred million years, the first stars lit up the darkness. Inside them, and in their explosive deaths, hydrogen and helium were fused into carbon, oxygen, nitrogen and more. We are, quite literally, made of star stuff.',
    },
    tags: ['stars', 'supernova', 'elements'],
  },
  {
    id: 'earth-forms',
    yearsAgo: 4_540_000_000,
    yearLabel: '4.54 billion years ago',
    era: 'cosmic',
    title: 'Formation of the Earth',
    summary:
      'Our Sun and its planets condense from a collapsing cloud of gas and dust enriched by earlier generations of stars. Earth forms and is soon struck by a Mars-sized body that creates the Moon.',
    brainSignificance:
      'Earth provides liquid water, a rich supply of biologically useful elements and long-term stability, the setting in which chemistry can become biology and, much later, nervous systems.',
    image: { src: '/media/earth-forms.svg', alt: 'A molten young Earth glowing red, with a newly formed Moon close by in a dusty disk.' },
    audio: {
      src: '/media/earth-forms.mp3',
      transcript:
        'About 4.54 billion years ago, a cloud of gas and dust collapsed to form the Sun and its planets. Young Earth was molten and battered, yet it held the ingredients and, eventually, the oceans that life would need.',
    },
    tags: ['Earth', 'Solar System', 'Moon'],
  },
  {
    id: 'oceans-prebiotic-chemistry',
    yearsAgo: 4_300_000_000,
    yearLabel: '~4.3 to 4 billion years ago',
    era: 'cosmic',
    title: 'Oceans and Prebiotic Chemistry',
    summary:
      'Earth cools enough for liquid oceans to form. In pools, vents and shorelines, simple molecules assemble into amino acids, nucleotides and lipids.',
    brainSignificance:
      'Lipids self-assemble into membrane-bound compartments, and later, charged particles moving across such membranes become the basis of all electrical signaling in neurons.',
    details:
      'Where this chemistry occurred is debated: deep-sea hydrothermal vents, volcanic hot springs and impact-formed ponds are all candidates.',
    image: { src: '/media/oceans-prebiotic-chemistry.svg', alt: 'A hydrothermal vent in a dark ocean, releasing mineral-rich plumes with tiny membrane bubbles forming.' },
    audio: {
      src: '/media/oceans-prebiotic-chemistry.mp3',
      transcript:
        'As Earth cooled, oceans formed, and simple molecules began to combine into amino acids, nucleotides and fatty lipids. Lipids naturally curl into bubbles, tiny compartments that would one day wrap every living cell.',
    },
    tags: ['prebiotic chemistry', 'lipids', 'oceans'],
  },
  {
    id: 'first-life',
    yearsAgo: 3_800_000_000,
    yearLabel: '~3.8 to 3.5 billion years ago',
    era: 'origin',
    title: 'First Single-Celled Life',
    summary:
      'Self-replicating cells with membranes, DNA or RNA, and metabolism appear, the first bacteria and archaea. The earliest widely accepted fossils, stromatolites, are about 3.5 billion years old.',
    brainSignificance:
      'Every cell must sense its surroundings and respond. This basic ability to detect, process and react is the root from which nervous systems eventually grew.',
    details:
      'Chemical signs of life in older rocks, around 3.7 to 4.1 billion years old, are suggestive but contested.',
    image: { src: '/media/first-life.svg', alt: 'Simple rod-shaped microbes in layered mats beneath shallow ocean water, forming dome-like stromatolites.' },
    audio: {
      src: '/media/first-life.mp3',
      transcript:
        'Somewhere between 3.8 and 3.5 billion years ago, the first living cells appeared. They were simple bacteria and archaea, but they could already sense chemicals and respond. That is the seed of every nervous system.',
    },
    tags: ['LUCA', 'bacteria', 'archaea', 'stromatolites'],
  },
  {
    id: 'chemical-signalling',
    yearsAgo: 3_500_000_000,
    yearLabel: '~3.5 billion years ago (approx.)',
    era: 'origin',
    title: 'Chemical Signalling',
    summary:
      'Early cells evolve receptor proteins in their membranes that bind specific molecules and trigger internal changes, letting them read their environment.',
    brainSignificance:
      'Receptors and second-messenger pathways such as cyclic AMP and calcium signaling are ancient. Neurons still use the same toolkit, in the form of neurotransmitter receptors, to receive messages.',
    details:
      'Bacteria also talk to each other through quorum sensing, releasing molecules whose concentration tells them how many neighbors are nearby.',
    image: { src: '/media/chemical-signalling.svg', alt: 'A cell membrane with receptor proteins catching signal molecules that set off a cascade inside the cell.' },
    audio: {
      src: '/media/chemical-signalling.mp3',
      transcript:
        'Early cells learned to read their world with receptor proteins that catch specific molecules. A signal arriving outside sets off a chain reaction inside. Neurons still communicate using this ancient chemical language.',
    },
    tags: ['receptors', 'second messengers', 'quorum sensing'],
  },
  {
    id: 'ion-channels',
    yearsAgo: 3_000_000_000,
    yearLabel: '~3 billion years ago (approx.)',
    era: 'origin',
    title: 'Ion Channels and Membrane Potential',
    summary:
      'Microbes evolve pumps and channel proteins that move ions such as potassium, sodium and calcium across the membrane, creating an electrical voltage across it.',
    brainSignificance:
      'Voltage-gated ion channels are the core machinery of the nerve impulse. Bacterial relatives of sodium, potassium and calcium channels exist today, showing the parts for electrical signaling long predate neurons.',
    details:
      'Some bacteria even show electrical spiking in biofilms, using potassium waves to coordinate their communities.',
    image: { src: '/media/ion-channels.svg', alt: 'A cutaway of a cell membrane with a channel protein letting charged ions flow through, with plus and minus charges on either side.' },
    audio: {
      src: '/media/ion-channels.mp3',
      transcript:
        'Cells learned to pump charged ions across their membranes, building up a voltage like a tiny battery. Channel proteins that open and close that flow are the same machinery that fires every nerve impulse in your brain today.',
    },
    tags: ['ion channels', 'membrane potential', 'voltage'],
  },
  {
    id: 'bacterial-chemotaxis',
    yearsAgo: 2_500_000_000,
    yearLabel: '~2.5 billion years ago (approx.)',
    era: 'origin',
    title: 'Bacterial Chemotaxis',
    summary:
      'Bacteria develop a sensory-motor loop: receptors detect nutrient gradients, a signaling pathway adjusts flagellar motors, and the cell swims toward food or away from toxins.',
    brainSignificance:
      'Chemotaxis is a minimal stimulus-response circuit with sensing, simple memory and action. It is a conceptual ancestor of reflexes and of decision-making in nervous systems.',
    details:
      'E. coli compares concentrations over a few seconds, a primitive form of memory, and alternates between runs and tumbles to climb gradients. The exact date of origin is uncertain.',
    image: { src: '/media/bacterial-chemotaxis.svg', alt: 'A flagellated bacterium swimming along a curved path toward a cluster of food molecules.' },
    audio: {
      src: '/media/bacterial-chemotaxis.mp3',
      transcript:
        'Bacteria evolved a tiny sense-and-act loop. Receptors compare chemical levels over time, and the cell adjusts its spinning flagella to swim toward food and away from poison. It is a brainless decision, and a blueprint for reflexes.',
    },
    tags: ['chemotaxis', 'flagella', 'sensorimotor'],
  },
  {
    id: 'eukaryotes',
    yearsAgo: 2_000_000_000,
    yearLabel: '~2 to 1.8 billion years ago',
    era: 'origin',
    title: 'Eukaryotic Cells',
    summary:
      'An archaeal host cell engulfs a bacterium that becomes the mitochondrion, giving rise to eukaryotes: larger cells with a nucleus, internal membranes and a dynamic cytoskeleton.',
    brainSignificance:
      'Mitochondria supply the vast energy that large, complex cells need. Eukaryotes also gained calcium signaling, a cytoskeleton and internal vesicle traffic, all later used by neurons for transmission and growth.',
    details:
      'Fossil evidence is debated, with some estimates of eukaryote origins going back more than 2 billion years and others somewhat later.',
    image: { src: '/media/eukaryotes.svg', alt: 'A large cell with a nucleus and bean-shaped mitochondria, engulfing a smaller bacterium.' },
    audio: {
      src: '/media/eukaryotes.mp3',
      transcript:
        'Around two billion years ago, one cell swallowed another and the two became partners. The swallowed bacterium became the mitochondrion, a power plant that fueled bigger and more complex cells, including eventually neurons.',
    },
    tags: ['eukaryote', 'mitochondria', 'endosymbiosis', 'nucleus'],
  },
  {
    id: 'multicellularity',
    yearsAgo: 1_000_000_000,
    yearLabel: '~1 billion years ago (multiple origins)',
    era: 'origin',
    title: 'Multicellular Life',
    summary:
      'Multicellularity evolves repeatedly in different lineages, including the one that leads to animals, as cells stay together and begin to specialize.',
    brainSignificance:
      'Once many cells form a single body, they must coordinate. This need for long-range communication and division of labor between cells drives the evolution of dedicated signaling cells.',
    details:
      'Choanoflagellates, the closest living single-celled relatives of animals, can form colonies and already carry many genes later used in neuron synapses.',
    image: { src: '/media/multicellularity.svg', alt: 'A ball-shaped colony of flagellated cells swimming together in water.' },
    audio: {
      src: '/media/multicellularity.mp3',
      transcript:
        'Over a billion years ago, cells began sticking together and sharing the work. Multicellular bodies need coordination, and that need would eventually give rise to nerves. Our closest single-celled cousins, the choanoflagellates, already carry many genes later used in synapses.',
    },
    tags: ['multicellularity', 'choanoflagellates', 'cell specialization'],
  },
  {
    id: 'sponges-no-neurons',
    yearsAgo: 605_000_000,
    yearLabel: '~600 million years ago (approx.)',
    era: 'origin',
    title: 'Sponges: Animals Without Neurons',
    summary:
      'Sponges (Porifera), among the earliest-branching animals, appear. They filter feed with pumping cells but have no neurons, muscles or true tissues.',
    brainSignificance:
      'Sponges coordinate by chemical signals and slow calcium waves between cells, and they possess many synaptic-type genes. They show how much of the neural toolkit existed before neurons themselves.',
    details:
      'Whether sponges or comb jellies branched off first is still debated, which affects whether neurons evolved once or twice. Fossil biomarkers hint at sponges as early as 650 to 600 million years ago.',
    image: { src: '/media/sponges-no-neurons.svg', alt: 'A vase-shaped sponge on the seafloor, with arrows showing water flowing in through pores and out the top.' },
    audio: {
      src: '/media/sponges-no-neurons.mp3',
      transcript:
        'Sponges are some of the oldest animals alive. They have no neurons at all, yet their cells still signal each other with chemicals and calcium waves. They stand at the edge of the story, just before the first nerve cells.',
    },
    tags: ['sponges', 'Porifera', 'pre-neural', 'calcium waves'],
  },
];
