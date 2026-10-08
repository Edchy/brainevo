import { createContext, useContext } from 'react';
import type { SceneState } from './types';

export const SceneCtx = createContext<SceneState>({ t: 0, weight: 0, active: false });

/**
 * The scene's live state. The returned object is stable and MUTATED each frame:
 * read `.t` / `.weight` inside useFrame, never in render.
 */
export const useScene = () => useContext(SceneCtx);
