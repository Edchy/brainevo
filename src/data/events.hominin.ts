import type { TimelineEvent } from '../types';

export const hominEvents: TimelineEvent[] = [
  {
    breakthrough: 'mentalizing',
    id: 'sahelanthropus',
    yearsAgo: 7_000_000,
    yearLabel: '~7 million years ago',
    era: 'hominin',
    title: 'Sahelanthropus: the Dawn of the Hominin Line',
    summary:
      "Around 7 million years ago, in Chad, Sahelanthropus lived close to the split between our ancestors and chimpanzees. Its brain was chimp-sized, but its skull hints at an upright stance. The human brain's long story begins with a modest organ.",
    brainSignificance:
      'With a braincase of roughly 360 cm³, its brain was no larger than a chimpanzee\'s. The forward position of the foramen magnum hints at an upright head posture. If so, upright posture preceded brain expansion by millions of years.',
    details:
      "The famous skull, nicknamed Toumaï, was found in 2001. Whether it was a habitual biped is still debated, since the evidence rests on skull anatomy and on limb bones whose interpretation is disputed.",
    brainVolumeCc: 360,
    image: {
      src: '/media/sahelanthropus.svg',
      alt: 'Illustration of the Sahelanthropus tchadensis skull, with a small braincase and a flattened face.',
    },
    tags: ['Sahelanthropus', 'Chad', 'last common ancestor', 'foramen magnum'],
    sources: [
      { label: "Brunet et al. (2002). A new hominid from the Upper Miocene of Chad, Central Africa. Nature", url: "https://doi.org/10.1038/nature00879" },
      { label: "Zollikofer et al. (2005). Virtual cranial reconstruction of Sahelanthropus tchadensis. Nature", url: "https://doi.org/10.1038/nature03397" },
      { label: "Smithsonian Human Origins: Sahelanthropus tchadensis", url: "https://humanorigins.si.edu/evidence/human-fossils/species/sahelanthropus-tchadensis" },
    ],
  },
  {
    breakthrough: 'mentalizing',
    id: 'bipedalism',
    yearsAgo: 6_000_000,
    yearLabel: '~6 million years ago',
    era: 'hominin',
    title: 'Walking Upright',
    summary:
      "About 6 million years ago, early hominins started walking on two legs. This freed their hands to carry things and, eventually, to make tools. It also narrowed the pelvis, setting up a long-running tension between big brains and the birth canal.",
    brainSignificance:
      "Walking upright freed the hands from locomotion, which later made tool use and carrying possible. It reshaped the pelvis, and as brains grew, birth became harder: the “obstetric dilemma”, though the energy a mother can supply may limit gestation as much. The motor cortex and cerebellum took on new demands for balance and gait.",
    details:
      'Proposed benefits include energy-efficient travel across open woodland, carrying food or infants, and reaching fruit in trees.',
    image: {
      src: '/media/bipedalism.svg',
      alt: 'Side-by-side silhouettes of a knuckle-walking ape and an upright-walking early hominin.',
    },
    tags: ['bipedalism', 'Orrorin', 'pelvis', 'hands freed'],
    sources: [
      { label: "Senut et al. (2001). First hominid from the Miocene (Lukeino Formation, Kenya). Comptes Rendus", url: "https://doi.org/10.1016/s1251-8050(01)01529-4" },
      { label: "Smithsonian Human Origins: Orrorin tugenensis", url: "https://humanorigins.si.edu/evidence/human-fossils/species/orrorin-tugenensis" },
      { label: "Dunsworth et al. (2012). Metabolic hypothesis for human altriciality. PNAS", url: "https://doi.org/10.1073/pnas.1205282109" },
    ],
  },
  {
    breakthrough: 'mentalizing',
    id: 'ardipithecus',
    yearsAgo: 4_400_000,
    yearLabel: '~4.4 million years ago',
    era: 'hominin',
    title: 'Ardipithecus ramidus',
    summary:
      "About 4.4 million years ago, Ardi lived in Ethiopian woodland. She walked upright on the ground yet could still climb, thanks to a grasping big toe. Her brain was still chimp-sized, so the brain's big expansion had not begun.",
    brainSignificance:
      'Her brain was about 300 to 350 cm³, roughly chimpanzee-sized, so upright walking clearly came before a bigger brain. Her small canines suggest reduced male-male aggression, which some researchers link to more cooperation and social tolerance.',
    brainVolumeCc: 325,
    image: {
      src: '/media/ardipithecus.svg',
      alt: 'Reconstruction of Ardipithecus ramidus standing in woodland, with a grasping big toe.',
    },
    tags: ['Ardipithecus', 'Ardi', 'Ethiopia', 'grasping toe'],
    sources: [
      { label: "White et al. (2009). Ardipithecus ramidus and the paleobiology of early hominids. Science", url: "https://doi.org/10.1126/science.1175802" },
      { label: "Smithsonian Human Origins: Ardipithecus ramidus", url: "https://humanorigins.si.edu/evidence/human-fossils/species/ardipithecus-ramidus" },
    ],
  },
  {
    breakthrough: 'mentalizing',
    id: 'laetoli-footprints',
    yearsAgo: 3_660_000,
    yearLabel: '~3.66 million years ago',
    era: 'hominin',
    title: 'Footprints at Laetoli',
    summary:
      "About 3.7 million years ago, hominins walked across wet volcanic ash in what is now Tanzania. Their footprints hardened and survived. They show a human-like stride, long before our ancestors had big brains.",
    brainSignificance:
      "The prints show an arched foot and a heel-to-toe stride like our own, which shows that upright walking was established well before large brains. Several individuals walked together, a glimpse of group life.",
    details:
      "Another set of prints at Laetoli, restudied in 2021, may have been left by a different hominin, so more than one kind of biped may have lived there.",
    image: {
      src: '/media/laetoli-footprints.svg',
      alt: 'A trail of hominin footprints pressed into ancient volcanic ash.',
    },
    tags: ['Laetoli', 'footprints', 'Tanzania', 'gait'],
    sources: [
      { label: "Leakey & Hay (1979). Pliocene footprints in the Laetolil Beds at Laetoli, northern Tanzania. Nature", url: "https://doi.org/10.1038/278317a0" },
      { label: "McNutt et al. (2021). Footprint evidence of early hominin locomotor diversity at Laetoli, Tanzania. Nature", url: "https://doi.org/10.1038/s41586-021-04187-7" },
      { label: "Smithsonian Human Origins: Laetoli footprint trails", url: "https://humanorigins.si.edu/evidence/behavior/footprints/laetoli-footprint-trails" },
    ],
  },
  {
    breakthrough: 'mentalizing',
    id: 'australopithecus-lucy',
    yearsAgo: 3_200_000,
    yearLabel: '~3.2 million years ago',
    era: 'hominin',
    title: 'Australopithecus afarensis and "Lucy"',
    summary:
      "About 3.2 million years ago, Lucy, an Australopithecus afarensis, lived in Ethiopia. She walked upright but was just over a metre tall. Her kind had brains of about 400 to 500 cubic centimetres, still close to a chimpanzee’s.",
    brainSignificance:
      "Australopithecus afarensis had brains of about 400 to 550 cm³, only a little above a chimpanzee’s. Endocasts suggest an ape-like brain organisation, but a brain that kept growing for longer in childhood, an early hint of the slow human pattern.",
    details:
      "The skeleton is about 3.2 million years old and was nicknamed after the Beatles song “Lucy in the Sky with Diamonds”, which was playing in the expedition camp.",
    brainVolumeCc: 450,
    image: {
      src: '/media/australopithecus-lucy.svg',
      alt: 'Skeleton diagram of Lucy, a small australopithecine, with the recovered bones highlighted.',
    },
    tags: ['Lucy', 'Australopithecus', 'Ethiopia', 'endocast'],
    sources: [
      { label: "Gunz et al. (2020). Australopithecus afarensis endocasts suggest ape-like brain organization and prolonged brain growth. Science Advances", url: "https://doi.org/10.1126/sciadv.aaz4729" },
      { label: "Smithsonian Human Origins: Australopithecus afarensis", url: "https://humanorigins.si.edu/evidence/human-fossils/species/australopithecus-afarensis" },
    ],
  },
  {
    breakthrough: "mentalizing",
    id: 'oldowan-tools',
    yearsAgo: 2_800_000,
    yearLabel: "~2.9 to 2.6 million years ago",
    era: 'hominin',
    title: 'The First Stone Tools: Oldowan',
    summary:
      "Nearly 3 million years ago, hominins in Africa began striking flakes off stones to make sharp edges. Even this simple craft needs planning and precise hands. The meat these tools unlocked fed a hungry, growing brain.",
    brainSignificance:
      'Even simple flaking demands precise hand-eye coordination, planning, and an understanding of how stone breaks. Brain imaging of modern people making Oldowan tools shows activity in motor, visual, and attention networks. Tools gave access to meat and marrow, which supplied calories and fats for brain growth.',
    details:
      "At Nyayanga in Kenya, Oldowan tools about 2.9 million years old lie beside teeth of Paranthropus, so the first toolmakers may not have been our own genus. Older stone-working at Lomekwi, Kenya, about 3.3 million years ago, has also been reported.",
    image: {
      src: '/media/oldowan-tools.svg',
      alt: 'A rounded cobble chopper and sharp flakes of the Oldowan toolkit.',
    },
    tags: ['Oldowan', 'stone tools', 'flaking', 'meat'],
    sources: [
      { label: "Plummer et al. (2023). Expanded geographic distribution and dietary strategies of the earliest Oldowan hominins and Paranthropus. Science", url: "https://doi.org/10.1126/science.abo7452" },
      { label: "Harmand et al. (2015). 3.3-million-year-old stone tools from Lomekwi 3, West Turkana, Kenya. Nature", url: "https://doi.org/10.1038/nature14464" },
      { label: "Stout & Chaminade (2012). Stone tools, language and the brain in human evolution. Philosophical Transactions of the Royal Society B", url: "https://doi.org/10.1098/rstb.2011.0099" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'homo-habilis',
    yearsAgo: 2_300_000,
    yearLabel: '~2.3 million years ago',
    era: 'hominin',
    title: 'Homo habilis, the "Handy Man"',
    summary:
      "Over 2 million years ago, Homo habilis, the handy man, lived in Africa. Its brain was around 600 cubic centimetres, noticeably bigger than Lucy’s. It made simple stone tools and may show early hints of language-related brain structure, though that is debated.",
    brainSignificance:
      "Brain size rose to roughly 550 to 700 cm³, a clear step up from Lucy’s kind. Some endocasts of early Homo show a bulge in the region of Broca’s area, which some researchers read as an early step toward language-related circuits, though this is debated.",
    brainVolumeCc: 610,
    image: {
      src: '/media/homo-habilis.svg',
      alt: 'Portrait reconstruction of Homo habilis holding a stone flake.',
    },
    tags: ['Homo habilis', 'genus Homo', 'brain expansion'],
    sources: [
      { label: "Villmoare et al. (2015). Early Homo at 2.8 Ma from Ledi-Geraru, Afar, Ethiopia. Science", url: "https://doi.org/10.1126/science.aaa1343" },
      { label: "Spoor et al. (2015). Reconstructed Homo habilis type OH 7 suggests deep-rooted species diversity in early Homo. Nature", url: "https://doi.org/10.1038/nature14224" },
      { label: "Smithsonian Human Origins: Homo habilis", url: "https://humanorigins.si.edu/evidence/human-fossils/species/homo-habilis" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'homo-erectus',
    yearsAgo: 1_900_000,
    yearLabel: "~2 million years ago",
    era: 'hominin',
    title: 'Homo erectus: A Bigger Brain and Body',
    summary:
      "About 2 million years ago, Homo erectus appeared, with a body much like ours and a brain around 900 cubic centimetres. It was the first hominin known to spread far beyond Africa. Yet its children still grew up faster than ours do.",
    brainSignificance:
      "Brain size averaged about 900 cm³, and later populations reached over 1,000 cm³. Yet its teeth grew faster than ours: the dental development of the Turkana Boy is closer to an ape’s, so the long human childhood came later.",
    brainVolumeCc: 900,
    image: {
      src: '/media/homo-erectus.svg',
      alt: 'Skull of Homo erectus beside a modern human skull for scale.',
    },
    tags: ['Homo erectus', 'Turkana Boy', 'out of Africa', '900 cc'],
    sources: [
      { label: "Dean et al. (2001). Growth processes in teeth distinguish modern humans from Homo erectus and earlier hominins. Nature", url: "https://doi.org/10.1038/414628a" },
      { label: "Herries et al. (2020). Contemporaneity of Australopithecus, Paranthropus, and early Homo erectus in South Africa. Science", url: "https://doi.org/10.1126/science.aaw7293" },
      { label: "Smithsonian Human Origins: Homo erectus", url: "https://humanorigins.si.edu/evidence/human-fossils/species/homo-erectus" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'cooperative-breeding',
    yearsAgo: 1_800_000,
    yearLabel: '~1.8 million years ago',
    era: 'hominin',
    title: 'Cooperative Breeding',
    summary:
      "Raising a big-brained baby was costly, so hominin mothers likely turned to relatives and friends for help. Babies who could win over many caregivers did better. This shared parenting may have shaped our empathy and social minds.",
    brainSignificance:
      'Shared childcare lowered the burden on mothers and allowed shorter gaps between births. It also pushed infants to read the intentions of many caregivers, which may have favored social cognition, empathy, and shared attention. Human social intelligence may have grown out of this system.',
    details:
      "This is a hypothesis rather than a fossil observation. The timing is inferred from the larger brains and bodies of Homo erectus, which made each infant more costly to raise.",
    image: {
      src: '/media/cooperative-breeding.svg',
      alt: 'A group of hominins, including a grandmother and siblings, caring for an infant together.',
    },
    tags: ['cooperative breeding', 'Sarah Hrdy', 'social cognition', 'allomothers'],
    sources: [
      { label: "Hrdy (2009). Mothers and Others: The Evolutionary Origins of Mutual Understanding. Harvard University Press", url: "https://www.hup.harvard.edu/books/9780674060326" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'acheulean-handaxe',
    yearsAgo: 1_760_000,
    yearLabel: '~1.76 million years ago',
    era: 'hominin',
    title: 'Acheulean Handaxes',
    summary:
      "Around 1.76 million years ago, toolmakers began shaping stones into symmetrical handaxes. Making one means holding a final shape in mind and working toward it step by step. The skill was passed on across generations for more than a million years.",
    brainSignificance:
      'Making a handaxe requires a mental template of the final shape, planning many steps ahead, and fine motor control. Studies of modern toolmakers show that it engages frontal and parietal regions. The tradition also suggests teaching, and perhaps imitation or early language.',
    image: {
      src: '/media/acheulean-handaxe.svg',
      alt: 'A symmetrical teardrop-shaped Acheulean handaxe.',
    },
    tags: ['Acheulean', 'handaxe', 'planning', 'teaching'],
    sources: [
      { label: "Lepre et al. (2011). An earlier origin for the Acheulian. Nature", url: "https://doi.org/10.1038/nature10372" },
      { label: "Stout & Chaminade (2012). Stone tools, language and the brain in human evolution. Philosophical Transactions of the Royal Society B", url: "https://doi.org/10.1098/rstb.2011.0099" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'expensive-tissue',
    yearsAgo: 1_500_000,
    yearLabel: '~1.5 million years ago',
    era: 'hominin',
    title: 'The Expensive-Tissue Hypothesis',
    summary:
      "The brain uses about a fifth of our energy at rest. The expensive-tissue hypothesis suggests that hominins paid for this by shrinking their guts, once better food made a large digestive system unnecessary. The idea is debated, but it ties diet to brain growth.",
    brainSignificance:
      'A higher-quality diet of meat, marrow, and later cooked food allowed a smaller digestive tract. The energy saved could then run a larger brain. This links diet, tool use, and brain growth. Newer work stresses other factors too, such as body fat, reduced muscle, and cooperative foraging.',
    details:
      'The hypothesis is influential but contested. A large comparative study found that brain size in mammals is not clearly traded off against gut size.',
    image: {
      src: '/media/expensive-tissue.svg',
      alt: 'Diagram comparing a large gut and small brain with a small gut and large brain.',
    },
    tags: ['expensive-tissue', 'metabolism', 'diet', 'gut'],
    sources: [
      { label: "Aiello & Wheeler (1995). The expensive-tissue hypothesis. Current Anthropology", url: "https://doi.org/10.1086/204350" },
      { label: "Navarrete, van Schaik & Isler (2011). Energetics and the evolution of human brain size. Nature", url: "https://doi.org/10.1038/nature10629" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'broca-vocal-tract',
    yearsAgo: 1_200_000,
    yearLabel: '~2 to 0.5 million years ago',
    era: 'hominin',
    title: 'Broca\'s Area and the Early Vocal Tract',
    summary:
      "Casts of early Homo skulls show the frontal bulge where Broca's area sits, a region that helps with speech and with sequencing movements. Hominins also gained finer breath control and a more flexible vocal tract. When real language began is still a matter of debate.",
    brainSignificance:
      'Broca\'s area supports speech production and also helps with sequencing, such as the motor steps in toolmaking. Researchers debate when true language began. By the time of Homo heidelbergensis and Neanderthals, the ear and hyoid bone were consistent with human-like speech.',
    details:
      "Endocasts record only the outer shape of the brain, so claims about language are inferences. Humans also lost the vocal membranes that other primates have, which may have helped make a stable, speech-ready voice. Estimates of when speech began range from about 2 million years ago to the origin of our own species.",
    image: {
      src: '/media/broca-vocal-tract.svg',
      alt: 'Side view of a skull endocast with Broca\'s area highlighted, and a diagram of the vocal tract.',
    },
    tags: ['Broca\'s area', 'endocast', 'vocal tract', 'language'],
    sources: [
      { label: "Martínez et al. (2004). Auditory capacities in Middle Pleistocene humans from the Sierra de Atapuerca in Spain. PNAS", url: "https://doi.org/10.1073/pnas.0403595101" },
      { label: "D’Anastasio et al. (2013). Micro-biomechanics of the Kebara 2 hyoid and its implications for speech in Neanderthals. PLoS ONE", url: "https://doi.org/10.1371/journal.pone.0082261" },
      { label: "Nishimura et al. (2022). Evolutionary loss of complexity in human vocal anatomy as an adaptation for speech. Science", url: "https://doi.org/10.1126/science.abm1574" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'control-of-fire',
    yearsAgo: 1_000_000,
    yearLabel: '~1 million years ago',
    era: 'hominin',
    title: 'Control of Fire and Cooking',
    summary:
      "By about a million years ago, our ancestors were using fire under control. Cooked food is easier to digest, giving more energy for less effort, which may have helped feed larger brains. Evenings by the fire also left more time to be social.",
    brainSignificance:
      'Cooking makes food softer and easier to digest, so more energy is absorbed for less chewing and digesting. Richard Wrangham argues this supported a bigger brain and smaller gut and teeth. Fire also extended the day, creating time for storytelling and social bonding.',
    details:
      'Some researchers claim much earlier use of fire, perhaps 1.8 million years ago, but regular hearths become common only after about 400,000 years ago.',
    image: {
      src: '/media/control-of-fire.svg',
      alt: 'Hominins gathered around a campfire at night.',
    },
    tags: ['fire', 'cooking', 'Wrangham', 'Wonderwerk'],
    sources: [
      { label: "Berna et al. (2012). Microstratigraphic evidence of in situ fire in the Acheulean strata of Wonderwerk Cave. PNAS", url: "https://doi.org/10.1073/pnas.1117620109" },
      { label: "Goren-Inbar et al. (2004). Evidence of hominin control of fire at Gesher Benot Ya’aqov, Israel. Science", url: "https://doi.org/10.1126/science.1095443" },
      { label: "Roebroeks & Villa (2011). On the earliest evidence for habitual use of fire in Europe. PNAS", url: "https://doi.org/10.1073/pnas.1018116108" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'homo-heidelbergensis',
    yearsAgo: 700_000,
    yearLabel: '~700,000 years ago',
    era: 'hominin',
    title: 'Homo heidelbergensis',
    summary:
      "Homo heidelbergensis was a large hominin with a brain of around 1,200 cubic centimetres. It hunted big game, which demanded teamwork and planning. It may be close to the common ancestor of Neanderthals and modern humans.",
    brainSignificance:
      'Brain size ranged from about 1,100 to 1,400 cm³, close to the modern human range. Group hunting of large animals required coordination, planning, and communication. Some researchers view this species, or a close relative, as the ancestor of both Neanderthals and modern humans.',
    details:
      "Wooden spears from Schöningen in Germany, long credited to this species, were redated in 2025 to about 200,000 years ago and may have been made by early Neanderthals. Which fossils belong in Homo heidelbergensis is itself debated.",
    brainVolumeCc: 1200,
    image: {
      src: '/media/homo-heidelbergensis.svg',
      alt: 'Skull of Homo heidelbergensis with a heavy brow ridge.',
    },
    tags: ['Homo heidelbergensis', 'Schöningen', 'spears', 'big-game hunting'],
    sources: [
      { label: "Smithsonian Human Origins: Homo heidelbergensis", url: "https://humanorigins.si.edu/evidence/human-fossils/species/homo-heidelbergensis" },
      { label: "University of York (2025). Age of Schöningen spears revised to 200,000 years", url: "https://www.york.ac.uk/news-and-events/news/2025/research/age-schoningen-spears" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'neanderthals',
    yearsAgo: 400_000,
    yearLabel: '~400,000 years ago',
    era: 'hominin',
    title: 'Neanderthals',
    summary:
      "Neanderthals lived in Europe and western Asia for hundreds of thousands of years. Their brains averaged about 1,500 cubic centimetres, a little larger than ours, though shaped differently. They made fine tools, controlled fire, and looked after their sick.",
    brainSignificance:
      'Their brains averaged about 1,500 cm³, slightly larger than the modern human average. Their bodies were heavier, so brain size alone says little. Their brains were shaped somewhat differently, with possibly larger visual areas and a less globular braincase. How their cognition compared with ours is still actively studied.',
    brainVolumeCc: 1500,
    image: {
      src: '/media/neanderthals.svg',
      alt: 'Portrait of a Neanderthal with a long, low skull and heavy brow.',
    },
    tags: ['Neanderthal', '1500 cc', 'Europe', 'Homo neanderthalensis'],
    sources: [
      { label: "Higham et al. (2014). The timing and spatiotemporal patterning of Neanderthal disappearance. Nature", url: "https://doi.org/10.1038/nature13621" },
      { label: "Pearce, Stringer & Dunbar (2013). New insights into differences in brain organization between Neanderthals and anatomically modern humans. Proceedings of the Royal Society B", url: "https://doi.org/10.1098/rspb.2013.0168" },
      { label: "Smithsonian Human Origins: Homo neanderthalensis", url: "https://humanorigins.si.edu/evidence/human-fossils/species/homo-neanderthalensis" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'denisovans',
    yearsAgo: 325_000,
    yearLabel: '~400,000 to 50,000 years ago',
    era: 'hominin',
    title: 'Denisovans',
    summary:
      "Denisovans are known from a few bones in a Siberian cave, plus their DNA. They were cousins of the Neanderthals and mixed with both Neanderthals and our own ancestors. Traces of their genes are still found in people today.",
    brainSignificance:
      "Few fossils survive, but large molars and jaws show they were big-bodied. Ancient DNA shows that some Denisovan gene variants live on in people today, notably in Oceania and Tibet, where one of them helps with life at high altitude.",
    details:
      'The Harbin skull from China, identified as Denisovan in 2025, suggests a large braincase of about 1,420 cm³.',
    image: {
      src: '/media/denisovans.svg',
      alt: 'A finger bone and molar tooth from Denisova Cave, with a DNA strand.',
    },
    tags: ['Denisovans', 'ancient DNA', 'Siberia', 'interbreeding'],
    sources: [
      { label: "Fu et al. (2025). Denisovan mitochondrial DNA from dental calculus of the >146,000-year-old Harbin cranium. Cell", url: "https://doi.org/10.1016/j.cell.2025.05.040" },
      { label: "Huerta-Sánchez et al. (2014). Altitude adaptation in Tibetans caused by introgression of Denisovan-like DNA. Nature", url: "https://doi.org/10.1038/nature13408" },
      { label: "Slon et al. (2018). The genome of the offspring of a Neanderthal mother and a Denisovan father. Nature", url: "https://doi.org/10.1038/s41586-018-0455-x" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'homo-naledi',
    yearsAgo: 335_000,
    yearLabel: '~335,000 years ago',
    era: 'hominin',
    title: 'Homo naledi: A Small Brain in a Late Species',
    summary:
      "Homo naledi lived in South Africa as recently as a quarter of a million years ago, yet its brain was about the size of early Homo's. Brain size is not the whole story. How its remains got deep into a cave is still debated.",
    brainSignificance:
      'Its brain was only about 460 to 610 cm³, near that of Homo habilis, yet it lived alongside early Homo sapiens. Its endocasts show a human-like frontal lobe pattern. This shows that brain size is not a simple measure of behavior. Claims that it buried its dead are controversial.',
    brainVolumeCc: 500,
    image: {
      src: '/media/homo-naledi.svg',
      alt: 'Skull of Homo naledi with a small braincase and a narrow cave passage behind it.',
    },
    tags: ['Homo naledi', 'Rising Star', 'small brain', 'South Africa'],
    sources: [
      { label: "Dirks et al. (2017). The age of Homo naledi and associated sediments in the Rising Star Cave, South Africa. eLife", url: "https://doi.org/10.7554/eLife.24231" },
      { label: "Holloway et al. (2018). Endocast morphology of Homo naledi from the Dinaledi Chamber, South Africa. PNAS", url: "https://doi.org/10.1073/pnas.1720842115" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'teaching-cumulative-culture',
    yearsAgo: 500_000,
    yearLabel: '~500,000 years ago (debated)',
    era: 'hominin',
    title: 'Teaching and Cumulative Culture',
    summary:
      "Humans do something rare: we teach, and learners copy carefully. Each generation starts where the last left off. Exactly when this ratchet began is debated, but it changed what a brain could know.",
    brainSignificance:
      'Teaching needs a model of what the learner does not know, which builds on mentalizing. It turns individual brains into a shared store: knowledge outlives its holders. This ratchet probably drove later brain and culture expansion.',
    details:
      'Researchers such as Michael Tomasello and Joseph Henrich emphasize the human ratchet effect. Evidence for teaching in early stone tools is suggestive rather than conclusive.',
    image: {
      src: '/media/teaching-cumulative-culture.svg',
      alt: 'An older toolmaker guiding a child hands as they strike a stone, with a chain of hands behind them',
    },
    tags: ['teaching','cumulative culture','social learning','ratchet effect'],
    sources: [
      { label: "Tennie, Call & Tomasello (2009). Ratcheting up the ratchet: on the evolution of cumulative culture. Philosophical Transactions of the Royal Society B", url: "https://doi.org/10.1098/rstb.2009.0052" },
    ],
  },
];
