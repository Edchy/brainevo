// Prints sorted events with their station index (= units of world.stationF). Run: npx tsx scripts/list-events.ts
import { events } from '../src/data';
events.forEach((e, i) => console.log(String(i).padStart(2), e.era.padEnd(10), (e.breakthrough ?? '').padEnd(11), e.id.padEnd(36), e.yearLabel));
