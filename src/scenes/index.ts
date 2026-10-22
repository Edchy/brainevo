import type { SceneDef } from '../world/types';
import { cosmicScenes } from './cosmic';
import { lifeScenes } from './life';
import { vertebrateScenes } from './vertebrate';
import { mammalScenes } from './mammal';
import { primateScenes } from './primate';
import { hominScenes } from './hominin';
import { humanScenes } from './human';
import { futureScenes } from './future';

export const SCENES: SceneDef[] = [
  ...cosmicScenes,
  ...lifeScenes,
  ...vertebrateScenes,
  ...mammalScenes,
  ...primateScenes,
  ...hominScenes,
  ...humanScenes,
  ...futureScenes,
];
