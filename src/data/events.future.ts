import type { TimelineEvent } from '../types';

/**
 * What comes next. The human future is uncertain, so it is only sketched (the painting turns to underdrawing, see
 * src/lib/vision.ts); the Sun's and the stars' futures follow from physics, so they are painted again.
 */
export const futureEvents: TimelineEvent[] = [
  {
    breakthrough: 'speaking',
    id: 'minds-and-machines',
    yearsAgo: -15,
    yearLabel: 'The coming decades',
    era: 'future',
    title: 'Minds and Machines',
    summary:
      "What comes next is not painted yet. Machines that learn could help us understand the brain, heal it, maybe even connect to it. They could also be misused. Whether a machine can ever feel is an open question. The brush is in our hands.",
    brainSignificance:
      "Brain-computer interfaces already give some people with paralysis back their speech or movement, and AI models are now used to study the brain itself. Whether any machine could be conscious is unresolved: a 2023 review by scientists and philosophers found no current AI system that is a strong candidate, and no obvious barrier to building one.",
    tags: ['future', 'artificial intelligence', 'consciousness'],
    sources: [
      { label: "Butlin et al. (2023). Consciousness in artificial intelligence: insights from the science of consciousness (arXiv:2308.08708)", url: "https://arxiv.org/abs/2308.08708" },
      { label: "Willett et al. (2023). A high-performance speech neuroprosthesis. Nature", url: "https://doi.org/10.1038/s41586-023-06377-x" },
    ],
  },
  {
    breakthrough: 'speaking',
    id: 'your-lifetime',
    yearsAgo: -50,
    yearLabel: 'Your lifetime',
    era: 'future',
    title: 'Four Thousand Weeks',
    summary:
      "A long human life is about 4,000 weeks. Each square here is one of them. Tell us your age, and the weeks you have already lived will fill in. The rest are still blank. Nobody else gets to paint them.",
    brainSignificance:
      "Eighty years is about 4,170 weeks. The writer Oliver Burkeman built a book around that number, and Tim Urban drew a whole life as a grid of weeks. The age you enter stays in this browser and is never sent anywhere.",
    extra: 'weeks',
    tags: ['lifetime', 'time', 'mortality'],
    sources: [
      { label: "Urban (2014). Your life in weeks. Wait But Why", url: "https://waitbutwhy.com/2014/05/life-weeks.html" },
      { label: "Burkeman (2021). Four Thousand Weeks: Time Management for Mortals", url: "https://www.oliverburkeman.com/fourthousandweeks" },
    ],
  },
  {
    id: 'sun-brightens',
    yearsAgo: -1.5e9,
    yearLabel: 'In 1 to 2 billion years',
    era: 'future',
    title: 'The Sun Grows Brighter',
    summary:
      "The Sun is slowly brightening. Within one or two billion years, it will make Earth too hot for life as we know it. Every species, every city, every name will be gone.",
    brainSignificance:
      "Stars like the Sun grow brighter as they age, by roughly ten percent every billion years. Exactly when Earth stops being habitable depends on the climate model: older estimates said under a billion years, newer three-dimensional models one and a half to two billion or more.",
    tags: ['Sun', 'far future', 'habitability'],
    sources: [
      { label: "Wolf & Toon (2015). The evolution of habitable climates under the brightening Sun. Journal of Geophysical Research: Atmospheres", url: "https://doi.org/10.1002/2015jd023302" },
    ],
  },
  {
    id: 'red-giant',
    yearsAgo: -5e9,
    yearLabel: 'In about 5 billion years',
    era: 'future',
    title: 'The Sun Becomes a Red Giant',
    summary:
      "In about 5 billion years, the Sun will run out of hydrogen at its core and swell into a red giant, probably swallowing the Earth. Much of what made you will drift back into space, to build new stars and worlds.",
    brainSignificance:
      "As it swells, the Sun will shed about a third of its mass. In one detailed model, the Earth is dragged into it about 7.6 billion years from now. The gas the Sun throws off joins the clouds from which new stars and planets form.",
    tags: ['Sun', 'red giant', 'far future'],
    sources: [
      { label: "Schröder & Smith (2008). Distant future of the Sun and Earth revisited. Monthly Notices of the Royal Astronomical Society", url: "https://doi.org/10.1111/j.1365-2966.2008.13022.x" },
    ],
  },
  {
    id: 'last-stars',
    yearsAgo: -1e14,
    yearLabel: 'In about 100 trillion years',
    era: 'future',
    title: 'The Last Stars',
    summary:
      "In about 100 trillion years, the universe will stop making stars. One by one, the last ones will fade. Then, as far as we know, the dark.",
    brainSignificance:
      "As galaxies use up their gas, star formation ends. What is left are white dwarfs, neutron stars and black holes, cooling and dimming over spans of time that make the age of the universe look like an instant.",
    tags: ['far future', 'stars', 'cosmology'],
    sources: [
      { label: "Adams & Laughlin (1997). A dying universe: the long-term fate and evolution of astrophysical objects. Reviews of Modern Physics", url: "https://doi.org/10.1103/revmodphys.69.337" },
    ],
  },
];

/**
 * The closing reflection: one line per station, centred, no headline. Its "Read more" says why each line is true.
 * They come after everything else in this order (see src/data/index.ts), so `yearsAgo` is 0: here and now.
 */
const coda = (e: Omit<TimelineEvent, 'yearsAgo' | 'yearLabel' | 'era' | 'kind'>): TimelineEvent =>
  ({ yearsAgo: 0, yearLabel: 'Now', era: 'after', kind: 'coda', ...e });

export const codaEvents: TimelineEvent[] = [
  coda({
    id: 'coda-imagine',
    title: 'Imagine Being Dead',
    summary: "Try to imagine being dead.",
    brainSignificance:
      "Most people find it impossible: whatever they picture, someone is still there picturing it. The psychologist Jesse Bering argues that this limit of imagination is one reason belief in an afterlife comes so naturally to us.",
    extra: 'imagine',
    sources: [
      { label: "Bering (2006). The folk psychology of souls. Behavioral and Brain Sciences", url: "https://doi.org/10.1017/s0140525x06009101" },
    ],
  }),
  coda({
    id: 'coda-someone',
    title: 'Someone Was Still There',
    summary:
      "You probably pictured darkness, or silence. But someone was still there, noticing the dark. A brain, it seems, cannot imagine its own absence. That may be one reason so many people believe something comes after. Maybe it does. Science can't tell us.",
    brainSignificance:
      "In one study, young children watched a puppet show in which a mouse was eaten by an alligator. Most understood that its body had stopped working, yet many said it could still feel and think. Expecting a mind to go on may come naturally to a brain that models minds.",
    sources: [
      { label: "Bering & Bjorklund (2004). The natural emergence of reasoning about the afterlife as a developmental regularity. Developmental Psychology", url: "https://doi.org/10.1037/0012-1649.40.2.217" },
      { label: "Bering (2006). The folk psychology of souls. Behavioral and Brain Sciences", url: "https://doi.org/10.1017/s0140525x06009101" },
    ],
  }),
  coda({
    id: 'coda-before',
    title: 'You Have Been Here Before',
    summary:
      "And this dark isn't new to you. It's the same dark as the 13.8 billion years before you were born, and those never troubled you. The Roman poet Lucretius made this point more than two thousand years ago.",
    brainSignificance:
      "In On the Nature of Things, Lucretius argued that the time after our death mirrors the time before our birth, so there is nothing in it to fear. Philosophers still argue about whether the symmetry holds.",
    sources: [
      { label: "Stanford Encyclopedia of Philosophy. Death (on Lucretius' symmetry argument)", url: "https://plato.stanford.edu/entries/death/" },
    ],
  }),
  coda({
    id: 'coda-scale',
    title: 'Both Are True',
    summary:
      "So here is the strange part. On the scale of the universe, nothing you do matters. On the scale of a life, almost everything does. Both are true. You get to choose which one to live by.",
    brainSignificance:
      "Your brain may be the only thing in this whole story that can hold both scales at once: it can picture 13.8 billion years, and still care about one afternoon.",
  }),
  coda({
    id: 'coda-electricity',
    title: 'Electricity',
    summary:
      "Every fear you've had, every doubt, the voice that says you're not enough: electricity, racing through your neurons. What other people think of you? Electricity too, in their heads. Real, yes. But a thought is not a fact.",
    brainSignificance:
      "Thoughts and feelings are patterns of electrical and chemical signalling between neurons. Learning to notice a thought without treating it as the truth is a core skill in several evidence-based therapies.",
    sources: [
      { label: "Hayes et al. (2006). Acceptance and commitment therapy: model, processes and outcomes. Behaviour Research and Therapy", url: "https://doi.org/10.1016/j.brat.2005.06.006" },
    ],
  }),
  coda({
    id: 'coda-nobody',
    title: 'Nobody Has It Figured Out',
    summary:
      "Everyone is figuring it out as they go. Even very successful people often feel like impostors; psychologists first described it in 1978. Nobody was handed a manual. There isn't one.",
    brainSignificance:
      "The impostor phenomenon was named by Pauline Clance and Suzanne Imes in a study of high-achieving women, and has since been found across professions and levels of success. From the outside we see other people's results, never their doubts.",
    sources: [
      { label: "Clance & Imes (1978). The imposter phenomenon in high achieving women. Psychotherapy: Theory, Research & Practice", url: "https://doi.org/10.1037/h0086006" },
      { label: "Bravata et al. (2020). Prevalence, predictors, and treatment of impostor syndrome: a systematic review. Journal of General Internal Medicine", url: "https://doi.org/10.1007/s11606-019-05364-1" },
    ],
  }),
  coda({
    id: 'coda-invented',
    title: 'Everything Is Invented',
    summary:
      "Money, borders, job titles, the rules about how to be: all invented, by brains like yours. Most of what we treat as fixed was made up, and can be made again. You're allowed to invent too.",
    brainSignificance:
      "Language let humans share things that exist only because we agree on them: laws, nations, companies, money. They work because many brains believe in them together, and they change when enough brains imagine something new.",
  }),
  coda({
    id: 'coda-mistakes',
    title: 'Get It Wrong',
    summary:
      "Every brain in this story learned by getting things wrong. A mistake is a surprise, and surprise is exactly the signal neurons learn from. So don't hide. Try. Get it wrong. Try again.",
    brainSignificance:
      "Dopamine neurons fire most when an outcome is better or worse than expected: a prediction error. That error is the teaching signal of learning by trial and error, the second breakthrough in this story.",
    sources: [
      { label: "Schultz, Dayan & Montague (1997). A neural substrate of prediction and reward. Science", url: "https://doi.org/10.1126/science.275.5306.1593" },
    ],
  }),
  coda({
    id: 'coda-here',
    title: 'Here, Now',
    summary:
      "You are 13.8 billion years in the making: atoms from the Big Bang and from long-dead stars, an unbroken line of life four billion years long. There has never been another you. You live here, now. Breathe in.",
    brainSignificance:
      "Every one of your ancestors, back to the first cells, lived long enough to pass life on. All life on Earth descends from a common ancestor that lived about 4.2 billion years ago.",
    extra: 'breath',
    sources: [
      { label: "Moody et al. (2024). The nature of the last universal common ancestor and its impact on the early Earth system. Nature Ecology & Evolution", url: "https://doi.org/10.1038/s41559-024-02461-1" },
    ],
  }),
  coda({
    id: 'coda-morning',
    title: 'It Is Still Morning',
    summary:
      "And it is early. Stars will keep forming for about 100 trillion years. If that span were a single day, we would be twelve seconds past midnight. The story has barely begun, and you are in it.",
    brainSignificance:
      "The universe is 13.8 billion years old. Stars should go on forming for about 100 trillion years, so the universe has lived about 0.014 percent of its starlit age so far.",
    sources: [
      { label: "Adams & Laughlin (1997). A dying universe: the long-term fate and evolution of astrophysical objects. Reviews of Modern Physics", url: "https://doi.org/10.1103/revmodphys.69.337" },
    ],
  }),
  coda({
    id: 'coda-heartbeats',
    title: 'Your Heartbeats',
    summary:
      "That is about how many times your heart has beaten since you arrived. Thank you for spending them here. Now go and spend the rest.",
    brainSignificance:
      "A resting heart beats about 60 to 100 times a minute; the count here assumes 70, from the moment you opened the page. Over eighty years, that is close to three billion beats.",
    extra: 'heartbeats',
  }),
];
