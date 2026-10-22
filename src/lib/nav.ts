/**
 * Lets code outside the React tree move the timeline (the dev-only voice guide). App registers how; until it has,
 * every call is a no-op.
 */
export interface Nav {
  /** travel to an event by id; false if there is no such event */
  goToEvent(id: string): boolean;
  /** travel to a station by index (clamped) */
  goToIndex(i: number): void;
}
let nav: Nav | null = null;
export const setNav = (n: Nav | null) => { nav = n; };
export const getNav = () => nav;
