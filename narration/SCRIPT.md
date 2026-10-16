# Narration script: Evolution of the Brain

84 lines, 3,112 words, about 21 minutes at 150 words a minute.
Generated from the event data by `npx tsx scripts/narration.ts export`; edit the text in `src/data/`, not here.

## How to record

**Automatic (recommended).** With an ElevenLabs API key and the voice you picked:

```
ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... npx tsx scripts/narration.ts voice
```

Every line becomes `src/assets/narration/<file>`. Each request sends the neighbouring lines as context so the
delivery flows from one event to the next. Lines that already have a file are skipped.

**By hand.** In ElevenLabs Text to Speech, paste one line at a time, generate, download, and save it under exactly
the file name shown (for example `big-bang.mp3`) in `src/assets/narration/`.

Suggested settings: model Multilingual v2 (or v3 for more expressive reads), stability 0.5, similarity 0.75,
style 0.15, speaker boost on, speed 0.95.

### Voice direction

Warm, unhurried, intimate documentary narration: think a late-night natural history programme, not a trailer.
Mid-low register, gentle smile in the voice, real curiosity. Leave air at full stops. Never announce or sell.
Pace about 150 words a minute. The listener is scrolling through deep time; each line is a small, complete thought.

## Lines

### The Dark Beginning

**00 · `big-bang.mp3`** · The Big Bang

Around 13.8 billion years ago, the universe began expanding from an unimaginably hot, dense state. Within minutes it had forged hydrogen and helium. Every hydrogen atom in your brain was made in that first moment.

**01 · `first-stars-heavy-elements.mp3`** · First Stars and Heavy Elements

Within a few hundred million years, the first stars lit up the darkness. Inside them, and in their explosive deaths, hydrogen and helium were fused into carbon, oxygen, nitrogen and more. We are, quite literally, made of star stuff.

**02 · `earth-forms.mp3`** · Formation of the Earth

About 4.54 billion years ago, a cloud of gas and dust collapsed to form the Sun and its planets. Young Earth was molten and battered, yet it held the ingredients and, eventually, the oceans that life would need.

**03 · `oceans-prebiotic-chemistry.mp3`** · Oceans and Prebiotic Chemistry

As Earth cooled, oceans formed, and simple molecules began to combine into amino acids, nucleotides and fatty lipids. Lipids naturally curl into bubbles, tiny compartments that would one day wrap every living cell.

### Spark of Life

**04 · `first-life.mp3`** · First Single-Celled Life

Somewhere between 3.8 and 3.5 billion years ago, the first living cells appeared. They were simple bacteria and archaea, but they could already sense chemicals and respond. That is the seed of every nervous system.

**05 · `chemical-signalling.mp3`** · Chemical Signalling

Early cells learned to read their world with receptor proteins that catch specific molecules. A signal arriving outside sets off a chain reaction inside. Neurons still communicate using this ancient chemical language.

**06 · `ion-channels.mp3`** · Ion Channels and Membrane Potential

Cells learned to pump charged ions across their membranes, building up a voltage like a tiny battery. Channel proteins that open and close that flow are the same machinery that fires every nerve impulse in your brain today.

**07 · `bacterial-chemotaxis.mp3`** · Bacterial Chemotaxis

Bacteria evolved a tiny sense-and-act loop. Receptors compare chemical levels over time, and the cell adjusts its spinning flagella to swim toward food and away from poison. It is a brainless decision, and a blueprint for reflexes.

**08 · `eukaryotes.mp3`** · Eukaryotic Cells

Around two billion years ago, one cell swallowed another and the two became partners. The swallowed bacterium became the mitochondrion, a power plant that fueled bigger and more complex cells, including eventually neurons.

**09 · `multicellularity.mp3`** · Multicellular Life

Over a billion years ago, cells began sticking together and sharing the work. Multicellular bodies need coordination, and that need would eventually give rise to nerves. Our closest single-celled cousins, the choanoflagellates, already carry many genes later used in synapses.

**10 · `sponges-no-neurons.mp3`** · Sponges: Animals Without Neurons

Sponges are some of the oldest animals alive. They have no neurons at all, yet their cells still signal each other with chemicals and calcium waves. They stand at the edge of the story, just before the first nerve cells.

### First Nerves

**11 · `first-neurons-nerve-net.mp3`** · First Neurons and the Nerve Net

Around six hundred million years ago, some animals began to use cells that carry electrical signals. In jellyfish and sea anemones this takes the form of a nerve net, a web of neurons with no central command. It was the first step toward every brain that followed.

**12 · `bilateral-symmetry-ganglia.mp3`** · Bilateral Symmetry and Ganglia

Animals that crawl or swim in one direction developed a head end and a tail end, with matching left and right sides. Their neurons began to gather into clusters called ganglia, connected by nerve cords. Centralizing the nervous system made faster and smarter responses possible.

**13 · `cephalization.mp3`** · Cephalization: The First Heads

As animals moved forward through the world, their senses and neurons piled up at the front. This process is called cephalization, and it created the first heads. The cluster of neurons in a head is what we now call a brain.

**14 · `cambrian-explosion-eyes.mp3`** · The Cambrian Explosion and the Rise of Eyes

About five hundred and forty million years ago, animal life diversified dramatically in the Cambrian explosion. Many animals evolved eyes, and the race between hunters and hunted favored sharper senses. Processing all that visual information pushed brains to become more complex.

### The Vertebrate Plan

**15 · `chordates-notochord-nerve-cord.mp3`** · Chordates: Notochord and Dorsal Nerve Cord

Chordates added a stiff rod called the notochord and a hollow nerve cord along the back. That nerve cord is the forerunner of our spinal cord and brain. It also helped these animals swim with coordinated, wave-like movements.

**16 · `first-vertebrates-neural-crest.mp3`** · The First Vertebrates

Around five hundred and twenty million years ago, the first true vertebrates swam in Cambrian seas. They had a head with paired eyes and a protective braincase, built by new embryonic cells called the neural crest. These innovations let the brain grow more complex.

**17 · `tripartite-brain.mp3`** · The Tripartite Brain

Early vertebrates organized their brains into three parts: the forebrain, the midbrain and the hindbrain. Each part took on different jobs, from smell and vision to balance and breathing. Your own brain still follows this ancient three-part plan.

**18 · `dopamine-reinforcement-signal.mp3`** · Dopamine as a Learning Signal

Early in vertebrate history, neurons that release dopamine took on a special job. They fire when things turn out better than expected and fall silent when worse. That teaching signal lets an animal learn which actions lead to good outcomes.

**19 · `lampreys-brain-and-cerebellum.mp3`** · Lampreys, a Cerebellum and Image-Forming Eyes

Lampreys are living jawless fishes that preserve a very old vertebrate brain design. They have a camera-style eye and a small cerebellum for coordinating movement. Studying them shows that the main vertebrate brain layout arose before jaws did.

**20 · `basal-ganglia-actor-critic.mp3`** · Basal Ganglia: Actor and Critic

Deep in the forebrain, the basal ganglia pick the next action. Dopamine adjusts how strongly each choice is favored, based on how well it turned out. Scientists often compare this to an actor choosing and a critic judging, and the circuit appears in lampreys.

**21 · `myelin-jawed-fish.mp3`** · Jawed Fishes and Myelin

Jawed fishes appeared and spread, and with them came myelin, a fatty wrapping around nerve fibers. Myelin makes signals travel much faster and more efficiently. Fast nerves were a big advantage for large, active predators.

**22 · `pallium-fish-forebrain.mp3`** · The Pallium in the Fish Forebrain

The roof of the vertebrate forebrain is called the pallium. In fishes it handles smell, learning and memory. Much later, in mammals, a part of it would swell into the cerebral cortex.

**23 · `tetrapods-move-to-land.mp3`** · Tetrapods Move onto Land

About three hundred and seventy-five million years ago, lobe-finned fishes like Tiktaalik began to crawl onto land. Life in air demanded new ways to see, hear and move. The nervous system adapted, with new circuits for walking and for hearing sound through air.

**24 · `amniotes-first-eggs.mp3`** · Amniotes: Life Free from Water

Amniotes evolved eggs that could survive on land, freeing animals from needing water to reproduce. They spread across dry habitats and soon divided into the reptile and mammal lineages. Their forebrains began to develop the layered structures that would later become the cortex.

**25 · `synapsids.mp3`** · Synapsids Split from Reptile Ancestors

This is the start of our own branch of the tree. Around 310 million years ago, the synapsids split from the reptile line. Their brains were still small and reptilian, but they held the pallium tissue that would one day become the neocortex.

**26 · `reptile-brain-plan.mp3`** · The Reptile Brain Plan

Reptiles evolved a compact brain with strong brainstem, midbrain and basal ganglia circuits for movement, habit and survival. A thin layered cortex sat on top. These ancient structures are still present in the human brain, though modern research shows reptile brains are more capable than once believed.

### Warm-Blooded Minds

**27 · `cynodont-endothermy.mp3`** · Cynodonts and the Road to Warm-bloodedness

Cynodonts were among the first synapsids to look and act a bit like mammals. As their bodies learned to stay warm, their nervous systems could work faster and for longer. Energy-hungry brains finally had a steady power supply.

**28 · `nocturnal-bottleneck.mp3`** · Early Mammals Take the Night Shift

Imagine a creature the size of a shrew, hiding from dinosaurs by day. At night it hunts by smell, sound, and whiskers. Those senses expanded the brain regions that would become the heart of the mammalian mind.

**29 · `neocortex.mp3`** · The Six-Layered Neocortex Appears

Only mammals have a neocortex, a thin sheet of neurons stacked in six layers. The same circuit pattern repeats across the sheet. Make the sheet bigger and you get new abilities, which is exactly what happened later.

**30 · `mammalian-middle-ear.mp3`** · Three Tiny Bones Sharpen Hearing

Three tiny bones in your middle ear began as part of the jaw. Their move into the skull made hearing sharper, especially for high-pitched sounds. The brain gained a richer acoustic world to analyze.

**31 · `limbic-hippocampus.mp3`** · Limbic System and Hippocampus Take Shape

Memory, emotion, and bonding came together in the limbic system. The hippocampus builds maps of places and stores events. Together with feelings, this let mammals learn quickly and care for their young.

**32 · `vicarious-trial-and-error-replay.mp3`** · Imagining Paths: Replay in the Hippocampus

A rat at a fork in a maze sometimes stops and looks both ways. In its hippocampus, cells fire in sequence as if it were walking down each path. This looks like a simple form of imagining, and it lets mammals try options before acting.

**33 · `agranular-prefrontal-simulation.mp3`** · Agranular Prefrontal Cortex and Mental Simulation

Early mammals developed frontal cortex that connects the new neocortex to the older brain systems for emotion and action. It may have decided when to imagine, and which imagined outcomes were worth acting on. This is a hypothesis, and it is still being tested.

**34 · `kpg-mammal-radiation.mp3`** · Dinosaurs Fall and Mammals Radiate

When the dinosaurs vanished, mammals inherited the Earth. With no giant predators ruling the day, they spread into new habitats and lifestyles. Brains grew and diversified along with them.

### Seeing and Social

**35 · `first-primates.mp3`** · The First Primates Climb into the Trees

Early primates lived in the trees. Grasping branches and leaping between them called for careful vision and fine touch. The brain started to devote more tissue to hands and eyes.

**36 · `forward-eyes-visual-cortex.mp3`** · Forward-Facing Eyes and a Visual Brain

Two eyes facing forward give two slightly different views of the same scene. The brain compares them to see depth. A large visual cortex grew to process all of this, and vision became the main primate sense.

**37 · `trichromatic-vision.mp3`** · Trichromatic Color Vision

A small gene duplication gave our ancestors a third kind of color receptor. Suddenly ripe fruit stood out from leaves. The brain gained a new color channel to interpret.

**38 · `prefrontal-expansion.mp3`** · Monkeys and the Growing Prefrontal Cortex

Monkeys and apes enlarged the front of the brain. This area holds information in mind, plans ahead, and holds back impulses. It is the beginning of the thoughtful, flexible behavior we recognize in ourselves.

**39 · `social-brain.mp3`** · Group Living Drives Bigger Brains

Primates who live in larger groups tend to have a larger neocortex. Keeping track of who is friend, rival, or relative is a demanding mental task. That social puzzle is one major reason these brains grew.

**40 · `imitation-learning-primates.mp3`** · Learning by Watching: Imitation and Mirror Neurons

Primates learn a great deal by watching. In monkeys, some neurons fire both when the animal grasps an object and when it sees another grasp. Watching others lets one individual inherit the lessons of many.

**41 · `great-ape-cognition.mp3`** · Great Apes: Reasoning, Tools, and Culture

The great apes are our close relatives and impressive thinkers. They make and use tools, plan ahead, and teach habits to others. Many of these skills probably began in a shared ancestor millions of years ago.

**42 · `mental-state-inference-primates.mp3`** · Inferring What Others Know and Want

Apes keep track of what others can see and want. A subordinate chimpanzee may take food that a dominant one cannot see. Scientists debate how much this is true mind-reading, but it points to a model of other minds.

**43 · `mirror-self-recognition.mp3`** · Recognizing Oneself in the Mirror

Put a mark on a chimpanzee’s face and show it a mirror, and it touches the mark on itself. That is the mirror test. It suggests a sense of self that we share with our closest relatives.

### Upright and Inventive

**44 · `sahelanthropus.mp3`** · Sahelanthropus: the Dawn of the Hominin Line

Around seven million years ago in Chad, a small-brained ape called Sahelanthropus lived close to the split between our ancestors and the chimpanzees. Its brain was about the size of a chimp's, but its skull hints at an upright stance. The long story of the human brain begins with a modest organ.

**45 · `bipedalism.mp3`** · Walking Upright

Some six million years ago, early hominins started walking on two legs. This freed their hands to carry things and, eventually, to make tools. It also narrowed the pelvis, setting up a long-running tension between big brains and the birth canal.

**46 · `ardipithecus.mp3`** · Ardipithecus ramidus

Ardi lived in Ethiopian woodland about four and a half million years ago. She walked upright on the ground yet could still climb, thanks to a grasping big toe. Her brain was still chimp-sized, so the brain's big expansion had not begun.

**47 · `laetoli-footprints.mp3`** · Footprints at Laetoli

Three and a half million years ago, hominins walked across wet volcanic ash in what is now Tanzania. Their footprints hardened and survived. They show a human-like stride, long before our ancestors had big brains.

**48 · `australopithecus-lucy.mp3`** · Australopithecus afarensis and "Lucy"

Lucy was an Australopithecus afarensis who lived in Ethiopia over three million years ago. She walked upright but was just over a metre tall. Her brain, about 400 to 450 cubic centimetres, was still close to a chimpanzee's.

**49 · `oldowan-tools.mp3`** · The First Stone Tools: Oldowan

About two and a half million years ago, hominins in Africa began striking flakes off stones to make sharp edges. Even this simple craft needs planning and precise hands. The meat these tools unlocked fed a hungry, growing brain.

**50 · `homo-habilis.mp3`** · Homo habilis, the "Handy Man"

Homo habilis, the handy man, lived in Africa over two million years ago. Its brain was around 600 cubic centimetres, noticeably bigger than Lucy's. It made simple stone tools and may have been the first to show hints of language-related brain structure.

**51 · `homo-erectus.mp3`** · Homo erectus: A Bigger Brain and Body

Homo erectus appeared nearly two million years ago, with a body much like ours and a brain around 900 cubic centimetres. It was the first hominin to spread far beyond Africa. A longer childhood gave its young more time to learn.

**52 · `cooperative-breeding.mp3`** · Cooperative Breeding

Raising a big-brained baby was costly, so hominin mothers likely turned to relatives and friends for help. Babies who could win over many caregivers did better. This shared parenting may have shaped our empathy and social minds.

**53 · `acheulean-handaxe.mp3`** · Acheulean Handaxes

Around 1.76 million years ago, toolmakers began shaping stones into symmetrical handaxes. Making one means holding a final shape in mind and working toward it step by step. The skill was passed on across generations for more than a million years.

**54 · `expensive-tissue.mp3`** · The Expensive-Tissue Hypothesis

The brain uses about a fifth of our energy at rest. The expensive-tissue hypothesis suggests that hominins paid for this by shrinking their guts, once better food made a large digestive system unnecessary. The idea is debated, but it ties diet to brain growth.

**55 · `broca-vocal-tract.mp3`** · Broca's Area and the Early Vocal Tract

Casts of early Homo skulls show the frontal bulge where Broca's area sits, a region that helps with speech and with sequencing movements. Hominins also gained finer breath control and a more flexible vocal tract. When real language began is still a matter of debate.

**56 · `control-of-fire.mp3`** · Control of Fire and Cooking

By about a million years ago, our ancestors were using fire under control. Cooking makes food easier to digest, so the body gets more energy for less effort, which may have helped feed larger brains. Evenings by the fire also gave people more time to be social.

**57 · `homo-heidelbergensis.mp3`** · Homo heidelbergensis

Homo heidelbergensis was a large hominin with a brain of around twelve hundred cubic centimetres. It hunted big game with wooden spears, which demanded teamwork and planning. It may be close to the common ancestor of Neanderthals and modern humans.

**58 · `teaching-cumulative-culture.mp3`** · Teaching and Cumulative Culture

Humans do something rare: we teach, and learners copy carefully. Each generation starts where the last left off. Exactly when this ratchet began is debated, but it changed what a brain could know.

**59 · `neanderthals.mp3`** · Neanderthals

Neanderthals lived in Europe and western Asia for hundreds of thousands of years. Their brains averaged about fifteen hundred cubic centimetres, a little larger than ours, though shaped differently. They made fine tools, controlled fire, and looked after their sick.

**60 · `homo-naledi.mp3`** · Homo naledi: A Small Brain in a Late Species

Homo naledi lived in South Africa as recently as a quarter of a million years ago, yet its brain was only about the size of an early Homo's. It reminds us that brain size is not the whole story. Its remains were found deep inside a cave, and why they got there remains debated.

**61 · `denisovans.mp3`** · Denisovans

Denisovans are known from a few bones in a Siberian cave, plus their DNA. They were cousins of the Neanderthals and mixed with both Neanderthals and our own ancestors. Traces of their genes are still found in people today.

### Language and Symbol

**62 · `jebel-irhoud-sapiens.mp3`** · The Earliest Homo sapiens

In the hills of Morocco, researchers found skulls about three hundred thousand years old. The faces look strikingly like ours. Inside, the brain was already large, though not yet shaped like ours.

**63 · `globular-brain.mp3`** · The Globular Brain

Our brains did not simply grow. They changed shape, becoming rounder and more globular. Expanded parietal areas and cerebellum may have supported new ways of thinking and planning.

**64 · `ochre-symbolic-thought.mp3`** · Ochre and Symbolic Thought

In a cave on the South African coast, people ground red ochre and engraved patterns into it. They strung shell beads. These were signs that stood for something, an early flicker of symbolic thought.

**65 · `language-shares-simulations.mp3`** · Language: Sharing Simulations

Until language, imagined scenes stayed inside one head. With words, a person can place a plan, a memory or a place in another mind. Language lets many brains work as one.

**66 · `language-foxp2.mp3`** · Language and FOXP2

Language is hard to find in fossils, but it left clues. The gene FOXP2 helps control the fine movements of speech. With words and grammar, minds could share plans, stories and memories.

**67 · `out-of-africa.mp3`** · Out of Africa

Around sixty thousand years ago, groups of modern humans left Africa for good. They crossed deserts, mountains and seas. Their flexible, social brains carried them to every continent but Antarctica.

**68 · `cave-art.mp3`** · Cave Art

By torchlight, people painted animals on cave walls and pressed their hands against the stone. Each image began as a picture in the mind. Art made the inner world visible to others.

**69 · `bone-flutes-music.mp3`** · Bone Flutes and Music

In caves in Germany, people carved flutes from bird bone and ivory. Music lights up many parts of the brain at once. It may have helped early communities bond and share feelings.

**70 · `burial-ritual.mp3`** · Burial and Ritual

People started laying their dead in graves, often with gifts of beads, ochre or tools. This hints at grief, memory and a concept of death. The brain was now imagining beyond the present moment.

**71 · `behavioural-modernity.mp3`** · Behavioural Modernity

Tools became finer and more varied. People sewed clothing, traded over long distances and wore ornaments. Culture itself became cumulative, as each generation built on what the last had learned.

### The Reflective Brain

**72 · `agriculture.mp3`** · Agriculture

About eleven thousand years ago, people began to sow grain and keep animals. Villages and towns followed. Life in bigger groups called for counting, planning and trust among many people.

**73 · `writing.mp3`** · Writing

Around five thousand two hundred years ago, scribes in Sumer pressed marks into clay. Reading repurposes parts of the visual brain that evolved for other tasks. Writing gave humanity a memory beyond any single mind.

**74 · `alphabet.mp3`** · The Alphabet

Alphabets trimmed writing down to a few dozen letters, each standing for a sound. That made reading far easier to learn. More minds could now take part in the written world.

**75 · `philosophy-of-mind.mp3`** · Philosophy and the Seat of the Mind

Ancient thinkers began to ask what the mind is and where it lives. Hippocrates declared that the brain is the source of joy and sorrow. The brain had started to study itself.

**76 · `printing-press.mp3`** · The Printing Press

Around 1440, Gutenberg built a press with movable type. Books became cheap and ideas spread widely. Human knowledge could now accumulate and be questioned at a much larger scale.

**77 · `scientific-revolution.mp3`** · The Scientific Revolution

In the sixteenth and seventeenth centuries, anatomists drew the brain with new accuracy. Thomas Willis tied brain structures to behaviour. Observation and experiment were becoming the tools for understanding the mind.

**78 · `neuron-doctrine.mp3`** · Neurons and the Localisation of Function

Broca and Wernicke linked speech to specific regions of the cortex. Then Cajal looked through his microscope and drew the neurons themselves. The brain, he showed, is a network of separate cells.

**79 · `eeg.mp3`** · The EEG

In 1929 Hans Berger recorded electrical rhythms from the human scalp. Brain waves could now be watched in a living person. They revealed the patterns of sleep, attention and seizures.

**80 · `fmri.mp3`** · fMRI

Functional MRI follows blood flow to reveal which parts of the brain are busy. It lets us see thinking, remembering and feeling in healthy people. Entire networks of the brain came into view.

**81 · `brain-computer-interfaces.mp3`** · Brain-Computer Interfaces

Tiny electrode arrays can now read movement and speech intentions from the cortex. People with paralysis have controlled cursors, robot arms and voice synthesisers by thought alone. The brain is learning to speak directly to machines.

**82 · `ai-mirror.mp3`** · AI as a Mirror

Neural networks, inspired loosely by the brain, can now see, translate and converse. They are very unlike biological brains. By comparing them with our own minds, we learn what intelligence might be.

**83 · `now.mp3`** · Now

Here we are. A brain of eighty-six billion neurons, running on twenty watts, is looking back over its own history. What it does next is up to us.

## Music (optional)

The site plays a generative score by default. To use recorded music instead, compose one loopable bed per era
(`npx tsx scripts/narration.ts music`, or paste these prompts into ElevenLabs Music, instrumental, about 2.5 minutes)
and save each as `src/assets/music/<era>.mp3`. Any era without a file keeps the generated score.

- **`cosmic.mp3`** (The Dark Beginning): Vast dark ambient orchestral drone, deep sub bass, slow-evolving low strings in D minor, distant glassy shimmer, no drums, cinematic, sense of cosmic emptiness and the first light, 60 bpm feel, no melody hooks, seamless loop
- **`origin.mp3`** (Spark of Life): Watery ambient soundscape in E Lydian, soft warm pads, gentle bubbling textures, slow harp-like plucks far in the background, no drums, wonder at the first living cells, cinematic and calm, seamless loop
- **`nerves.mp3`** (First Nerves): Delicate electronic-orchestral ambient in F sharp minor, soft pulsing pads like faint electrical signals, sparse celesta notes, no drums, curious and alive, cinematic, seamless loop
- **`vertebrate.mp3`** (The Vertebrate Plan): Deep ocean cinematic ambient in G dorian, slow cello and low strings, muted swells, distant whale-like resonances, no drums, ancient and patient, seamless loop
- **`mammal.mp3`** (Warm-Blooded Minds): Warm nocturnal forest ambient in A minor, intimate strings and soft woodwind pads, a hint of heartbeat-like low pulse, no drums, tender and alert, cinematic, seamless loop
- **`primate.mp3`** (Seeing and Social): Lush canopy ambient in C major and A minor, warm string pads, soft marimba-like plucks, gentle and social, no drums, cinematic nature documentary, seamless loop
- **`hominin.mp3`** (Upright and Inventive): Earthy cinematic ambient in D minor, low frame drum pulses very sparse, warm cello, breath-like textures, open savanna at dusk, slow and grounded, seamless loop
- **`sapiens.mp3`** (Language and Symbol): Hopeful cinematic ambient in E flat major, choir-like pads, soft piano notes far apart, cave-echo reverb, wonder at the first art and music, no drums, seamless loop
- **`modern.mp3`** (The Reflective Brain): Luminous modern cinematic ambient in E major, shimmering strings, soft piano and subtle electronic textures, reflective and quietly awe-struck, no drums, seamless loop
