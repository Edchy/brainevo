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
      'In what is now Chad, Sahelanthropus tchadensis lived near the time our lineage split from that of chimpanzees. Its skull combines a small, ape-sized braincase with a flatter face and small canines.',
    brainSignificance:
      'With a braincase of roughly 360 cm³, its brain was no larger than a chimpanzee\'s. The forward position of the foramen magnum hints at an upright head posture. If so, upright posture preceded brain expansion by millions of years.',
    details:
      'The famous skull "Toumaï" was found in 2001. Whether it was a habitual biped is still debated, since the evidence rests mostly on skull anatomy and a disputed femur.',
    brainVolumeCc: 360,
    image: {
      src: '/media/sahelanthropus.svg',
      alt: 'Illustration of the Sahelanthropus tchadensis skull, with a small braincase and a flattened face.',
    },
    audio: {
      src: '/media/sahelanthropus.mp3',
      transcript:
        'Around seven million years ago in Chad, a small-brained ape called Sahelanthropus lived close to the split between our ancestors and the chimpanzees. Its brain was about the size of a chimp\'s, but its skull hints at an upright stance. The long story of the human brain begins with a modest organ.',
    },
    tags: ['Sahelanthropus', 'Chad', 'last common ancestor', 'foramen magnum'],
  },
  {
    breakthrough: 'mentalizing',
    id: 'bipedalism',
    yearsAgo: 6_000_000,
    yearLabel: '~6 million years ago',
    era: 'hominin',
    title: 'Walking Upright',
    summary:
      'Early hominins such as Orrorin tugenensis began to walk on two legs, at least part of the time. Bipedalism became the defining trait of the hominin lineage.',
    brainSignificance:
      'Walking upright freed the hands from locomotion, which later made tool use and carrying possible. It also reshaped the pelvis, creating a tighter birth canal that would later limit brain size at birth. The motor cortex and cerebellum took on new demands for balance and gait control.',
    details:
      'Proposed benefits include energy-efficient travel across open woodland, carrying food or infants, and reaching fruit in trees.',
    image: {
      src: '/media/bipedalism.svg',
      alt: 'Side-by-side silhouettes of a knuckle-walking ape and an upright-walking early hominin.',
    },
    audio: {
      src: '/media/bipedalism.mp3',
      transcript:
        'Some six million years ago, early hominins started walking on two legs. This freed their hands to carry things and, eventually, to make tools. It also narrowed the pelvis, setting up a long-running tension between big brains and the birth canal.',
    },
    tags: ['bipedalism', 'Orrorin', 'pelvis', 'hands freed'],
  },
  {
    breakthrough: 'mentalizing',
    id: 'ardipithecus',
    yearsAgo: 4_400_000,
    yearLabel: '~4.4 million years ago',
    era: 'hominin',
    title: 'Ardipithecus ramidus',
    summary:
      'In Ethiopia, "Ardi" lived in a wooded habitat. She could walk upright on the ground but kept a grasping big toe for climbing trees.',
    brainSignificance:
      'Her brain was about 300 to 350 cm³, roughly chimpanzee-sized, so upright walking clearly came before a bigger brain. Her small canines suggest reduced male-male aggression, which some researchers link to more cooperation and social tolerance.',
    brainVolumeCc: 325,
    image: {
      src: '/media/ardipithecus.svg',
      alt: 'Reconstruction of Ardipithecus ramidus standing in woodland, with a grasping big toe.',
    },
    audio: {
      src: '/media/ardipithecus.mp3',
      transcript:
        'Ardi lived in Ethiopian woodland about four and a half million years ago. She walked upright on the ground yet could still climb, thanks to a grasping big toe. Her brain was still chimp-sized, so the brain\'s big expansion had not begun.',
    },
    tags: ['Ardipithecus', 'Ardi', 'Ethiopia', 'grasping toe'],
  },
  {
    breakthrough: 'mentalizing',
    id: 'laetoli-footprints',
    yearsAgo: 3_660_000,
    yearLabel: '~3.66 million years ago',
    era: 'hominin',
    title: 'Footprints at Laetoli',
    summary:
      'In Tanzania, hominins walked across fresh volcanic ash. The rain-dampened ash hardened and preserved a trail of footprints about 27 metres long, probably made by Australopithecus afarensis.',
    brainSignificance:
      'The prints show an arched foot and a heel-to-toe stride like our own, which proves that fully upright walking was established well before large brains. Two or three individuals walked together, a glimpse of group life.',
    image: {
      src: '/media/laetoli-footprints.svg',
      alt: 'A trail of hominin footprints pressed into ancient volcanic ash.',
    },
    audio: {
      src: '/media/laetoli-footprints.mp3',
      transcript:
        'Three and a half million years ago, hominins walked across wet volcanic ash in what is now Tanzania. Their footprints hardened and survived. They show a human-like stride, long before our ancestors had big brains.',
    },
    tags: ['Laetoli', 'footprints', 'Tanzania', 'gait'],
  },
  {
    breakthrough: 'mentalizing',
    id: 'australopithecus-lucy',
    yearsAgo: 3_200_000,
    yearLabel: '~3.2 million years ago',
    era: 'hominin',
    title: 'Australopithecus afarensis and "Lucy"',
    summary:
      'Lucy, a partial skeleton found in Ethiopia in 1974, was a small, upright-walking australopithecine. She stood about 1.1 metres tall and still had long arms suited to climbing.',
    brainSignificance:
      'Australopithecines had brains of about 400 to 450 cm³, only a little above a chimpanzee\'s, though relative to body size they were slightly larger. Endocasts suggest a mostly ape-like brain organization. The frontal and parietal regions were beginning to be reshaped.',
    details:
      'Her brain was probably around 400 cm³. The fossil is nicknamed after the Beatles song "Lucy in the Sky with Diamonds".',
    brainVolumeCc: 430,
    image: {
      src: '/media/australopithecus-lucy.svg',
      alt: 'Skeleton diagram of Lucy, a small australopithecine, with the recovered bones highlighted.',
    },
    audio: {
      src: '/media/australopithecus-lucy.mp3',
      transcript:
        'Lucy was an Australopithecus afarensis who lived in Ethiopia over three million years ago. She walked upright but was just over a metre tall. Her brain, about 400 to 450 cubic centimetres, was still close to a chimpanzee\'s.',
    },
    tags: ['Lucy', 'Australopithecus', 'Ethiopia', 'endocast'],
  },
  {
    breakthrough: 'speaking',
    id: 'oldowan-tools',
    yearsAgo: 2_600_000,
    yearLabel: '~2.6 million years ago',
    era: 'hominin',
    title: 'The First Stone Tools: Oldowan',
    summary:
      'In East Africa, hominins began striking flakes from cobbles to make sharp cutting edges. This Oldowan technology is the oldest widely accepted stone toolkit.',
    brainSignificance:
      'Even simple flaking demands precise hand-eye coordination, planning, and an understanding of how stone breaks. Brain imaging of modern people making Oldowan tools shows activity in motor, visual, and attention networks. Tools gave access to meat and marrow, which supplied calories and fats for brain growth.',
    details:
      'Older stone-working sites, such as Lomekwi in Kenya at about 3.3 million years ago, have been reported. Cut-marked bones from Ethiopia date to around 3.4 million years ago, though these claims are debated.',
    image: {
      src: '/media/oldowan-tools.svg',
      alt: 'A rounded cobble chopper and sharp flakes of the Oldowan toolkit.',
    },
    audio: {
      src: '/media/oldowan-tools.mp3',
      transcript:
        'About two and a half million years ago, hominins in Africa began striking flakes off stones to make sharp edges. Even this simple craft needs planning and precise hands. The meat these tools unlocked fed a hungry, growing brain.',
    },
    tags: ['Oldowan', 'stone tools', 'flaking', 'meat'],
  },
  {
    breakthrough: 'speaking',
    id: 'homo-habilis',
    yearsAgo: 2_300_000,
    yearLabel: '~2.3 million years ago',
    era: 'hominin',
    title: 'Homo habilis, the "Handy Man"',
    summary:
      'The earliest members of the genus Homo, such as Homo habilis, appeared in Africa. They used Oldowan tools and had larger brains than australopithecines.',
    brainSignificance:
      'Brain size rose to about 550 to 650 cm³, a jump of roughly 30 percent over Lucy. Endocasts show a more complex frontal lobe, including a bulge in the region of Broca\'s area, a possible early step toward language-related circuits.',
    brainVolumeCc: 610,
    image: {
      src: '/media/homo-habilis.svg',
      alt: 'Portrait reconstruction of Homo habilis holding a stone flake.',
    },
    audio: {
      src: '/media/homo-habilis.mp3',
      transcript:
        'Homo habilis, the handy man, lived in Africa over two million years ago. Its brain was around 600 cubic centimetres, noticeably bigger than Lucy\'s. It made simple stone tools and may have been the first to show hints of language-related brain structure.',
    },
    tags: ['Homo habilis', 'genus Homo', 'brain expansion'],
  },
  {
    breakthrough: 'speaking',
    id: 'homo-erectus',
    yearsAgo: 1_900_000,
    yearLabel: '~1.9 million years ago',
    era: 'hominin',
    title: 'Homo erectus: A Bigger Brain and Body',
    summary:
      'Homo erectus had modern body proportions and long legs, and it was the first hominin to spread widely out of Africa into Asia. It lived for well over a million years.',
    brainSignificance:
      'Brain size averaged about 900 cm³, and later populations reached over 1,000 cm³. Fossils such as the Turkana Boy show that growth was slower than in apes. Children had a longer period of dependence and learning, which suits a more complex brain.',
    brainVolumeCc: 900,
    image: {
      src: '/media/homo-erectus.svg',
      alt: 'Skull of Homo erectus beside a modern human skull for scale.',
    },
    audio: {
      src: '/media/homo-erectus.mp3',
      transcript:
        'Homo erectus appeared nearly two million years ago, with a body much like ours and a brain around 900 cubic centimetres. It was the first hominin to spread far beyond Africa. A longer childhood gave its young more time to learn.',
    },
    tags: ['Homo erectus', 'Turkana Boy', 'out of Africa', '900 cc'],
  },
  {
    breakthrough: 'speaking',
    id: 'cooperative-breeding',
    yearsAgo: 1_800_000,
    yearLabel: '~1.8 million years ago',
    era: 'hominin',
    title: 'Cooperative Breeding',
    summary:
      'As infants grew costlier to raise, hominin mothers likely relied on help from relatives and group members. Anthropologist Sarah Hrdy calls this "cooperative breeding".',
    brainSignificance:
      'Shared childcare lowered the burden on mothers and allowed shorter gaps between births. It also pushed infants to read the intentions of many caregivers, which may have favored social cognition, empathy, and shared attention. Human social intelligence may have grown out of this system.',
    details:
      'This is a hypothesis rather than a fossil observation. The timing is inferred from rising brain size and slower development in Homo erectus.',
    image: {
      src: '/media/cooperative-breeding.svg',
      alt: 'A group of hominins, including a grandmother and siblings, caring for an infant together.',
    },
    audio: {
      src: '/media/cooperative-breeding.mp3',
      transcript:
        'Raising a big-brained baby was costly, so hominin mothers likely turned to relatives and friends for help. Babies who could win over many caregivers did better. This shared parenting may have shaped our empathy and social minds.',
    },
    tags: ['cooperative breeding', 'Sarah Hrdy', 'social cognition', 'allomothers'],
  },
  {
    breakthrough: 'speaking',
    id: 'acheulean-handaxe',
    yearsAgo: 1_760_000,
    yearLabel: '~1.76 million years ago',
    era: 'hominin',
    title: 'Acheulean Handaxes',
    summary:
      'Homo erectus and relatives began making symmetrical, teardrop-shaped handaxes by shaping both faces of a stone. The tradition lasted well over a million years.',
    brainSignificance:
      'Making a handaxe requires a mental template of the final shape, planning many steps ahead, and fine motor control. Studies of modern toolmakers show that it engages frontal and parietal regions. The tradition also suggests teaching, and perhaps imitation or early language.',
    image: {
      src: '/media/acheulean-handaxe.svg',
      alt: 'A symmetrical teardrop-shaped Acheulean handaxe.',
    },
    audio: {
      src: '/media/acheulean-handaxe.mp3',
      transcript:
        'Around 1.76 million years ago, toolmakers began shaping stones into symmetrical handaxes. Making one means holding a final shape in mind and working toward it step by step. The skill was passed on across generations for more than a million years.',
    },
    tags: ['Acheulean', 'handaxe', 'planning', 'teaching'],
  },
  {
    breakthrough: 'speaking',
    id: 'expensive-tissue',
    yearsAgo: 1_500_000,
    yearLabel: '~1.5 million years ago',
    era: 'hominin',
    title: 'The Expensive-Tissue Hypothesis',
    summary:
      'Brain tissue burns about 20 percent of a human\'s resting energy, though it is only 2 percent of body weight. In 1995, Leslie Aiello and Peter Wheeler proposed that hominins paid for big brains by shrinking another costly organ, the gut.',
    brainSignificance:
      'A higher-quality diet of meat, marrow, and later cooked food allowed a smaller digestive tract. The energy saved could then run a larger brain. This links diet, tool use, and brain growth. Newer work stresses other factors too, such as body fat, reduced muscle, and cooperative foraging.',
    details:
      'The hypothesis is influential but contested. A large comparative study found that brain size in mammals is not clearly traded off against gut size.',
    image: {
      src: '/media/expensive-tissue.svg',
      alt: 'Diagram comparing a large gut and small brain with a small gut and large brain.',
    },
    audio: {
      src: '/media/expensive-tissue.mp3',
      transcript:
        'The brain uses about a fifth of our energy at rest. The expensive-tissue hypothesis suggests that hominins paid for this by shrinking their guts, once better food made a large digestive system unnecessary. The idea is debated, but it ties diet to brain growth.',
    },
    tags: ['expensive-tissue', 'metabolism', 'diet', 'gut'],
  },
  {
    breakthrough: 'speaking',
    id: 'broca-vocal-tract',
    yearsAgo: 1_200_000,
    yearLabel: '~2 to 0.5 million years ago',
    era: 'hominin',
    title: 'Broca\'s Area and the Early Vocal Tract',
    summary:
      'Endocasts of early Homo skulls show a growing frontal region where Broca\'s area lies. Over time, hominins also developed a lower, more flexible vocal tract and finer control of breathing.',
    brainSignificance:
      'Broca\'s area supports speech production and also helps with sequencing, such as the motor steps in toolmaking. Researchers debate when true language began. By the time of Homo heidelbergensis and Neanderthals, the ear and hyoid bone were consistent with human-like speech.',
    details:
      'Endocasts record only the outer shape of the brain, so claims about language are inferences. The estimate of when speech began ranges from about 2 million years ago to the origin of our own species.',
    image: {
      src: '/media/broca-vocal-tract.svg',
      alt: 'Side view of a skull endocast with Broca\'s area highlighted, and a diagram of the vocal tract.',
    },
    audio: {
      src: '/media/broca-vocal-tract.mp3',
      transcript:
        'Casts of early Homo skulls show the frontal bulge where Broca\'s area sits, a region that helps with speech and with sequencing movements. Hominins also gained finer breath control and a more flexible vocal tract. When real language began is still a matter of debate.',
    },
    tags: ['Broca\'s area', 'endocast', 'vocal tract', 'language'],
  },
  {
    breakthrough: 'speaking',
    id: 'control-of-fire',
    yearsAgo: 1_000_000,
    yearLabel: '~1 million years ago',
    era: 'hominin',
    title: 'Control of Fire and Cooking',
    summary:
      'Burned bone and ash at Wonderwerk Cave in South Africa, from about 1 million years ago, are among the earliest solid evidence of controlled fire. By around 800,000 years ago, Gesher Benot Ya\'aqov in Israel shows repeated burning.',
    brainSignificance:
      'Cooking makes food softer and easier to digest, so more energy is absorbed for less chewing and digesting. Richard Wrangham argues this supported a bigger brain and smaller gut and teeth. Fire also extended the day, creating time for storytelling and social bonding.',
    details:
      'Some researchers claim much earlier use of fire, perhaps 1.8 million years ago, but regular hearths become common only after about 400,000 years ago.',
    image: {
      src: '/media/control-of-fire.svg',
      alt: 'Hominins gathered around a campfire at night.',
    },
    audio: {
      src: '/media/control-of-fire.mp3',
      transcript:
        'By about a million years ago, our ancestors were using fire under control. Cooking makes food easier to digest, so the body gets more energy for less effort, which may have helped feed larger brains. Evenings by the fire also gave people more time to be social.',
    },
    tags: ['fire', 'cooking', 'Wrangham', 'Wonderwerk'],
  },
  {
    breakthrough: 'speaking',
    id: 'homo-heidelbergensis',
    yearsAgo: 700_000,
    yearLabel: '~700,000 years ago',
    era: 'hominin',
    title: 'Homo heidelbergensis',
    summary:
      'Large, robust hominins lived across Africa and Europe from about 700,000 to 200,000 years ago. They hunted big game, built shelters, and made wooden spears, as at Schöningen in Germany.',
    brainSignificance:
      'Brain size ranged from about 1,100 to 1,400 cm³, close to the modern human range. Group hunting of large animals required coordination, planning, and communication. Some researchers view this species, or a close relative, as the ancestor of both Neanderthals and modern humans.',
    brainVolumeCc: 1200,
    image: {
      src: '/media/homo-heidelbergensis.svg',
      alt: 'Skull of Homo heidelbergensis with a heavy brow ridge.',
    },
    audio: {
      src: '/media/homo-heidelbergensis.mp3',
      transcript:
        'Homo heidelbergensis was a large hominin with a brain of around twelve hundred cubic centimetres. It hunted big game with wooden spears, which demanded teamwork and planning. It may be close to the common ancestor of Neanderthals and modern humans.',
    },
    tags: ['Homo heidelbergensis', 'Schöningen', 'spears', 'big-game hunting'],
  },
  {
    breakthrough: 'speaking',
    id: 'neanderthals',
    yearsAgo: 400_000,
    yearLabel: '~400,000 years ago',
    era: 'hominin',
    title: 'Neanderthals',
    summary:
      'Neanderthals evolved in Europe and western Asia from about 400,000 years ago and survived until roughly 40,000 years ago. They made refined stone tools, used fire and adhesives, and cared for the injured.',
    brainSignificance:
      'Their brains averaged about 1,500 cm³, slightly larger than the modern human average. Their bodies were heavier, so brain size alone says little. Their brains were shaped somewhat differently, with possibly larger visual areas and a less globular braincase. How their cognition compared with ours is still actively studied.',
    brainVolumeCc: 1500,
    image: {
      src: '/media/neanderthals.svg',
      alt: 'Portrait of a Neanderthal with a long, low skull and heavy brow.',
    },
    audio: {
      src: '/media/neanderthals.mp3',
      transcript:
        'Neanderthals lived in Europe and western Asia for hundreds of thousands of years. Their brains averaged about fifteen hundred cubic centimetres, a little larger than ours, though shaped differently. They made fine tools, controlled fire, and looked after their sick.',
    },
    tags: ['Neanderthal', '1500 cc', 'Europe', 'Homo neanderthalensis'],
  },
  {
    breakthrough: 'speaking',
    id: 'denisovans',
    yearsAgo: 310_000,
    yearLabel: '~400,000 to 50,000 years ago',
    era: 'hominin',
    title: 'Denisovans',
    summary:
      'Denisovans are known mainly from fragments in Denisova Cave in Siberia and from DNA. They were a sister group to Neanderthals who lived in Asia, and they interbred with both Neanderthals and modern humans.',
    brainSignificance:
      'Few fossils survive, so their brain size is unknown, though a large molar and jaw show they were big-bodied. Ancient DNA shows that some Denisovan gene variants live on in people today, notably in Oceania and Tibet. Some of these variants affect the brain and immunity.',
    details:
      'The Harbin skull from China, identified as Denisovan in 2025, suggests a large braincase of about 1,420 cm³.',
    image: {
      src: '/media/denisovans.svg',
      alt: 'A finger bone and molar tooth from Denisova Cave, with a DNA strand.',
    },
    audio: {
      src: '/media/denisovans.mp3',
      transcript:
        'Denisovans are known from a few bones in a Siberian cave, plus their DNA. They were cousins of the Neanderthals and mixed with both Neanderthals and our own ancestors. Traces of their genes are still found in people today.',
    },
    tags: ['Denisovans', 'ancient DNA', 'Siberia', 'interbreeding'],
  },
  {
    breakthrough: 'speaking',
    id: 'homo-naledi',
    yearsAgo: 335_000,
    yearLabel: '~335,000 years ago',
    era: 'hominin',
    title: 'Homo naledi: A Small Brain in a Late Species',
    summary:
      'Fossils in the Rising Star Cave system in South Africa belong to Homo naledi, a small hominin that lived until at least 240,000 years ago. Its skeletons were found deep in a difficult cave passage.',
    brainSignificance:
      'Its brain was only about 460 to 610 cm³, near that of Homo habilis, yet it lived alongside early Homo sapiens. Its endocasts show a human-like frontal lobe pattern. This shows that brain size is not a simple measure of behavior. Claims that it buried its dead are controversial.',
    brainVolumeCc: 500,
    image: {
      src: '/media/homo-naledi.svg',
      alt: 'Skull of Homo naledi with a small braincase and a narrow cave passage behind it.',
    },
    audio: {
      src: '/media/homo-naledi.mp3',
      transcript:
        'Homo naledi lived in South Africa as recently as a quarter of a million years ago, yet its brain was only about the size of an early Homo\'s. It reminds us that brain size is not the whole story. Its remains were found deep inside a cave, and why they got there remains debated.',
    },
    tags: ['Homo naledi', 'Rising Star', 'small brain', 'South Africa'],
  },
  {
    breakthrough: 'speaking',
    id: 'teaching-cumulative-culture',
    yearsAgo: 500_000,
    yearLabel: '~500,000 years ago (debated)',
    era: 'hominin',
    title: 'Teaching and Cumulative Culture',
    summary:
      'Humans actively teach and copy faithfully, so skills accumulate over generations instead of being reinvented. When this began is debated; toolmaking traditions suggest increasing social transmission over the last million years or more.',
    brainSignificance:
      'Teaching needs a model of what the learner does not know, which builds on mentalizing. It turns individual brains into a shared store: knowledge outlives its holders. This ratchet probably drove later brain and culture expansion.',
    details:
      'Researchers such as Michael Tomasello and Joseph Henrich emphasize the human ratchet effect. Evidence for teaching in early stone tools is suggestive rather than conclusive.',
    image: {
      src: '/media/teaching-cumulative-culture.svg',
      alt: 'An older toolmaker guiding a child hands as they strike a stone, with a chain of hands behind them',
    },
    audio: {
      src: '/media/teaching-cumulative-culture.mp3',
      transcript:
        'Humans do something rare: we teach, and learners copy carefully. Each generation starts where the last left off. Exactly when this ratchet began is debated, but it changed what a brain could know.',
    },
    tags: ['teaching','cumulative culture','social learning','ratchet effect'],
  },
];
