import type { TimelineEvent } from '../types';

export const cosmicOriginEvents: TimelineEvent[] = [
  {
    id: 'big-bang',
    yearsAgo: 13_800_000_000,
    yearLabel: '13.8 billion years ago',
    era: 'cosmic',
    title: 'The Big Bang',
    summary:
      "The universe expands from an extremely hot, dense state. Within its first few minutes it forges the nuclei of the lightest elements, hydrogen and helium.",
    brainSignificance:
      "No brain yet exists, but nearly every hydrogen nucleus in every neuron dates from these first minutes. The physical laws that later allow chemistry, and so life and minds, are set here.",
    details:
      'About 380,000 years later the universe cooled enough for atoms to form and light to travel freely, leaving the cosmic microwave background we still detect today.',
    image: { src: '/media/big-bang.svg', alt: 'A bright point of light expanding outward into a field of cooling, glowing particles.' },
    audio: {
      src: '/media/big-bang.mp3',
      transcript:
        "Around 13.8 billion years ago, the universe began expanding from an unimaginably hot, dense state. Within minutes it had forged the nuclei of hydrogen and helium. Nearly all the hydrogen in your brain is that old.",
    },
    tags: ['Big Bang', 'hydrogen', 'cosmology'],
    sources: [
      { label: "Planck Collaboration (2020). Planck 2018 results: cosmological parameters. Astronomy & Astrophysics", url: "https://doi.org/10.1051/0004-6361/201833910" },
    ],
  },
  {
    id: 'first-stars-heavy-elements',
    yearsAgo: 13_600_000_000,
    yearLabel: "~13.6 billion years ago",
    era: 'cosmic',
    title: 'First Stars and Heavy Elements',
    summary:
      'The first stars ignite and fuse hydrogen and helium into carbon, oxygen, nitrogen, phosphorus and heavier elements, scattering them in supernovae.',
    brainSignificance:
      "Brains are built chiefly from carbon, hydrogen, oxygen, nitrogen and phosphorus, plus sodium, potassium, calcium and chlorine that neurons use to signal. Apart from hydrogen, all of these were forged in stars and their explosions.",
    image: { src: '/media/first-stars-heavy-elements.svg', alt: 'A massive star exploding as a supernova, spraying colorful clouds of newly made elements.' },
    audio: {
      src: '/media/first-stars-heavy-elements.mp3',
      transcript:
        'Within a few hundred million years, the first stars lit up the darkness. Inside them, and in their explosive deaths, hydrogen and helium were fused into carbon, oxygen, nitrogen and more. We are, quite literally, made of star stuff.',
    },
    tags: ['stars', 'supernova', 'elements'],
    sources: [
      { label: "Bromm (2013). Formation of the first stars. Reports on Progress in Physics", url: "https://doi.org/10.1088/0034-4885/76/11/112901" },
    ],
  },
  {
    id: 'earth-forms',
    yearsAgo: 4_540_000_000,
    yearLabel: '4.54 billion years ago',
    era: 'cosmic',
    title: 'Formation of the Earth',
    summary:
      "Our Sun and its planets condense from a collapsing cloud of gas and dust enriched by earlier generations of stars. Earth forms, and a collision with a Mars-sized body is thought to have created the Moon.",
    brainSignificance:
      'Earth provides liquid water, a rich supply of biologically useful elements and long-term stability, the setting in which chemistry can become biology and, much later, nervous systems.',
    image: { src: '/media/earth-forms.svg', alt: 'A molten young Earth glowing red, with a newly formed Moon close by in a dusty disk.' },
    audio: {
      src: '/media/earth-forms.mp3',
      transcript:
        'About 4.54 billion years ago, a cloud of gas and dust collapsed to form the Sun and its planets. Young Earth was molten and battered, yet it held the ingredients and, eventually, the oceans that life would need.',
    },
    tags: ['Earth', 'Solar System', 'Moon'],
    sources: [
      { label: "U.S. Geological Survey. Age of the Earth", url: "https://pubs.usgs.gov/gip/geotime/age.html" },
      { label: "Canup & Asphaug (2001). Origin of the Moon in a giant impact near the end of the Earth’s formation. Nature", url: "https://doi.org/10.1038/35089010" },
    ],
  },
  {
    id: 'oceans-prebiotic-chemistry',
    yearsAgo: 4_300_000_000,
    yearLabel: "~4.4 to 4 billion years ago",
    era: 'cosmic',
    title: 'Oceans and Prebiotic Chemistry',
    summary:
      "Earth cools enough for liquid water, perhaps as early as 4.4 billion years ago. In pools, vents and shorelines, simple molecules may have assembled into amino acids, nucleotides and lipids.",
    brainSignificance:
      'Lipids self-assemble into membrane-bound compartments, and later, charged particles moving across such membranes become the basis of all electrical signaling in neurons.',
    details:
      'Where this chemistry occurred is debated: deep-sea hydrothermal vents, volcanic hot springs and impact-formed ponds are all candidates.',
    image: { src: '/media/oceans-prebiotic-chemistry.svg', alt: 'A hydrothermal vent in a dark ocean, releasing mineral-rich plumes with tiny membrane bubbles forming.' },
    audio: {
      src: '/media/oceans-prebiotic-chemistry.mp3',
      transcript:
        "As Earth cooled, oceans formed, and simple molecules may have begun to combine into amino acids, nucleotides and fatty lipids. Lipids naturally curl into bubbles, tiny compartments that would one day wrap every living cell.",
    },
    tags: ['prebiotic chemistry', 'lipids', 'oceans'],
    sources: [
      { label: "Wilde et al. (2001). Evidence from detrital zircons for continental crust and oceans on the Earth 4.4 Gyr ago. Nature", url: "https://doi.org/10.1038/35051550" },
    ],
  },
  {
    id: 'first-life',
    yearsAgo: 3_800_000_000,
    yearLabel: "~4 to 3.5 billion years ago",
    era: 'origin',
    title: 'First Single-Celled Life',
    summary:
      "Self-replicating cells with membranes, genes and metabolism appear. The earliest widely accepted fossils, layered microbial mats called stromatolites, are about 3.5 billion years old.",
    brainSignificance:
      'Every cell must sense its surroundings and respond. This basic ability to detect, process and react is the root from which nervous systems eventually grew.',
    details:
      "Chemical signs of life in older rocks, around 3.7 to 4.1 billion years old, are suggestive but contested. A 2024 genetic study estimates that the last common ancestor of all living things lived about 4.2 billion years ago, so life may be older still.",
    image: { src: '/media/first-life.svg', alt: 'Simple rod-shaped microbes in layered mats beneath shallow ocean water, forming dome-like stromatolites.' },
    audio: {
      src: '/media/first-life.mp3',
      transcript:
        "By three and a half billion years ago, and probably much earlier, the first living cells had appeared. They were single cells, but they could already sense chemicals and respond. That is the seed of every nervous system.",
    },
    tags: ['LUCA', 'bacteria', 'archaea', 'stromatolites'],
    sources: [
      { label: "Allwood et al. (2006). Stromatolite reef from the Early Archaean era of Australia. Nature", url: "https://doi.org/10.1038/nature04764" },
      { label: "Moody et al. (2024). The nature of the last universal common ancestor and its impact on the early Earth system. Nature Ecology & Evolution", url: "https://doi.org/10.1038/s41559-024-02461-1" },
    ],
  },
  {
    id: 'chemical-signalling',
    yearsAgo: 3_500_000_000,
    yearLabel: "~3.5 billion years ago (inferred)",
    era: 'origin',
    title: 'Chemical Signalling',
    summary:
      'Early cells evolve receptor proteins in their membranes that bind specific molecules and trigger internal changes, letting them read their environment.',
    brainSignificance:
      "Receptors and second-messenger pathways such as cyclic AMP are ancient. Some of the receptors neurons use even have bacterial relatives: the family of ion channels that respond to acetylcholine, GABA and glycine is also found in bacteria.",
    details:
      'Bacteria also talk to each other through quorum sensing, releasing molecules whose concentration tells them how many neighbors are nearby.',
    image: { src: '/media/chemical-signalling.svg', alt: 'A cell membrane with receptor proteins catching signal molecules that set off a cascade inside the cell.' },
    audio: {
      src: '/media/chemical-signalling.mp3',
      transcript:
        'Early cells learned to read their world with receptor proteins that catch specific molecules. A signal arriving outside sets off a chain reaction inside. Neurons still communicate using this ancient chemical language.',
    },
    tags: ['receptors', 'second messengers', 'quorum sensing'],
    sources: [
      { label: "Bocquet et al. (2007). A prokaryotic proton-gated ion channel from the nicotinic acetylcholine receptor family. Nature", url: "https://doi.org/10.1038/nature05371" },
    ],
  },
  {
    id: 'ion-channels',
    yearsAgo: 3_000_000_000,
    yearLabel: "~3 billion years ago (inferred)",
    era: 'origin',
    title: 'Ion Channels and Membrane Potential',
    summary:
      'Microbes evolve pumps and channel proteins that move ions such as potassium, sodium and calcium across the membrane, creating an electrical voltage across it.',
    brainSignificance:
      'Voltage-gated ion channels are the core machinery of the nerve impulse. Bacterial relatives of sodium, potassium and calcium channels exist today, showing the parts for electrical signaling long predate neurons.',
    details:
      "Bacteria in biofilms even pass waves of electrical activity, carried by potassium ions, to coordinate their communities.",
    image: { src: '/media/ion-channels.svg', alt: 'A cutaway of a cell membrane with a channel protein letting charged ions flow through, with plus and minus charges on either side.' },
    audio: {
      src: '/media/ion-channels.mp3',
      transcript:
        'Cells learned to pump charged ions across their membranes, building up a voltage like a tiny battery. Channel proteins that open and close that flow are the same machinery that fires every nerve impulse in your brain today.',
    },
    tags: ['ion channels', 'membrane potential', 'voltage'],
    sources: [
      { label: "Ren et al. (2001). A prokaryotic voltage-gated sodium channel. Science", url: "https://doi.org/10.1126/science.1065635" },
      { label: "Prindle et al. (2015). Ion channels enable electrical communication in bacterial communities. Nature", url: "https://doi.org/10.1038/nature15709" },
    ],
  },
  {
    id: 'bacterial-chemotaxis',
    yearsAgo: 2_500_000_000,
    yearLabel: "Billions of years ago (date uncertain)",
    era: 'origin',
    title: 'Bacterial Chemotaxis',
    summary:
      'Bacteria develop a sensory-motor loop: receptors detect nutrient gradients, a signaling pathway adjusts flagellar motors, and the cell swims toward food or away from toxins.',
    brainSignificance:
      'Chemotaxis is a minimal stimulus-response circuit with sensing, simple memory and action. It is a conceptual ancestor of reflexes and of decision-making in nervous systems.',
    details:
      "E. coli compares concentrations over a few seconds, a primitive form of memory, and alternates between runs and tumbles to climb gradients. The chemotaxis system is shared across bacteria and archaea, but when it arose is unknown.",
    image: { src: '/media/bacterial-chemotaxis.svg', alt: 'A flagellated bacterium swimming along a curved path toward a cluster of food molecules.' },
    audio: {
      src: '/media/bacterial-chemotaxis.mp3',
      transcript:
        'Bacteria evolved a tiny sense-and-act loop. Receptors compare chemical levels over time, and the cell adjusts its spinning flagella to swim toward food and away from poison. It is a brainless decision, and a blueprint for reflexes.',
    },
    tags: ['chemotaxis', 'flagella', 'sensorimotor'],
    sources: [
      { label: "Berg & Brown (1972). Chemotaxis in Escherichia coli analysed by three-dimensional tracking. Nature", url: "https://doi.org/10.1038/239500a0" },
      { label: "Segall, Block & Berg (1986). Temporal comparisons in bacterial chemotaxis. PNAS", url: "https://doi.org/10.1073/pnas.83.23.8987" },
    ],
  },
  {
    id: 'eukaryotes',
    yearsAgo: 2_000_000_000,
    yearLabel: "~2 to 1.6 billion years ago",
    era: 'origin',
    title: 'Eukaryotic Cells',
    summary:
      "An archaeal host cell, related to today’s Asgard archaea, engulfs a bacterium that becomes the mitochondrion, giving rise to eukaryotes: larger cells with a nucleus, internal membranes and a dynamic cytoskeleton.",
    brainSignificance:
      'Mitochondria supply the vast energy that large, complex cells need. Eukaryotes also gained calcium signaling, a cytoskeleton and internal vesicle traffic, all later used by neurons for transmission and growth.',
    details:
      "Firm fossils of eukaryotes appear by about 1.6 billion years ago; estimates of their origin range from about 2 billion years ago to somewhat later.",
    image: { src: '/media/eukaryotes.svg', alt: 'A large cell with a nucleus and bean-shaped mitochondria, engulfing a smaller bacterium.' },
    audio: {
      src: '/media/eukaryotes.mp3',
      transcript:
        'Around two billion years ago, one cell swallowed another and the two became partners. The swallowed bacterium became the mitochondrion, a power plant that fueled bigger and more complex cells, including eventually neurons.',
    },
    tags: ['eukaryote', 'mitochondria', 'endosymbiosis', 'nucleus'],
    sources: [
      { label: "Eme et al. (2023). Inference and reconstruction of the heimdallarchaeial ancestry of eukaryotes. Nature", url: "https://doi.org/10.1038/s41586-023-06186-2" },
    ],
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
      "The oldest firmly dated multicellular eukaryote, the red alga Bangiomorpha, is about a billion years old. Choanoflagellates, the closest living single-celled relatives of animals, can form colonies and already carry many genes later used in neuron synapses.",
    image: { src: '/media/multicellularity.svg', alt: 'A ball-shaped colony of flagellated cells swimming together in water.' },
    audio: {
      src: '/media/multicellularity.mp3',
      transcript:
        'Over a billion years ago, cells began sticking together and sharing the work. Multicellular bodies need coordination, and that need would eventually give rise to nerves. Our closest single-celled cousins, the choanoflagellates, already carry many genes later used in synapses.',
    },
    tags: ['multicellularity', 'choanoflagellates', 'cell specialization'],
    sources: [
      { label: "Gibson et al. (2018). Precise age of Bangiomorpha pubescens dates the origin of eukaryotic photosynthesis. Geology", url: "https://doi.org/10.1130/g39829.1" },
      { label: "King et al. (2008). The genome of the choanoflagellate Monosiga brevicollis and the origin of metazoans. Nature", url: "https://doi.org/10.1038/nature06617" },
    ],
  },
  {
    id: 'sponges-no-neurons',
    yearsAgo: 605_000_000,
    yearLabel: '~600 million years ago (approx.)',
    era: 'origin',
    title: 'Sponges: Animals Without Neurons',
    summary:
      "Sponges (Porifera), among the earliest-branching animals, appear. They filter feed with pumping cells but have no neurons and no muscles.",
    brainSignificance:
      "Sponges coordinate through chemical signals, and glass sponges even conduct slow electrical impulses through their tissue. They also carry many synaptic-type genes, showing how much of the neural toolkit existed before neurons themselves.",
    details:
      "Whether sponges or comb jellies branched off first has long been debated. A 2023 study of ancient gene order favoured comb jellies, which would mean either that neurons arose twice or that sponges lost them. Fossil biomarkers hint at sponges as early as 650 to 600 million years ago, though these are debated too.",
    image: { src: '/media/sponges-no-neurons.svg', alt: 'A vase-shaped sponge on the seafloor, with arrows showing water flowing in through pores and out the top.' },
    audio: {
      src: '/media/sponges-no-neurons.mp3',
      transcript:
        'Sponges are some of the oldest animals alive. They have no neurons at all, yet their cells still signal each other with chemicals and calcium waves. They stand at the edge of the story, just before the first nerve cells.',
    },
    tags: ['sponges', 'Porifera', 'pre-neural', 'calcium waves'],
    sources: [
      { label: "Sakarya et al. (2007). A post-synaptic scaffold at the origin of the animal kingdom. PLoS ONE", url: "https://doi.org/10.1371/journal.pone.0000506" },
      { label: "Leys & Mackie (1997). Electrical recording from a glass sponge. Nature", url: "https://doi.org/10.1038/387029b0" },
      { label: "Schultz et al. (2023). Ancient gene linkages support ctenophores as sister to other animals. Nature", url: "https://doi.org/10.1038/s41586-023-05936-6" },
    ],
  },
];
