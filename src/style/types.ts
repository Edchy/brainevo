export interface Settings {
  /** master sound switch (narration, music, scene sounds). Off until the visitor turns it on: browsers block audio before a gesture. */
  sound: boolean;
  narration: boolean;
  music: boolean;
  /** the sounds of each scene (sea, wind, fire, neurons...) under the music */
  ambience: boolean;
}
