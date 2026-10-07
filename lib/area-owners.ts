import { AREAS, type Area } from "./board-config";
import type { PublicOwner, PublicTask } from "./public-dto";

export interface AreaOwner extends PublicOwner {
  /** Configured in MONDAY_AREA_OWNERS, so monday assigns new requests to them; otherwise inferred from the board. */
  assigned: boolean;
}

/**
 * Who answers for each area. The configured owners win, since monday assigns new requests to them; without them, the
 * person who has taken most of that area's requests stands in, so the requester still sees a name before sending.
 */
export function areaOwners(tasks: PublicTask[], configured: Partial<Record<Area, string[]>>, known: Map<string, PublicOwner>): Record<Area, AreaOwner[]> {
  const people = new Map([...known, ...tasks.flatMap((task) => task.owners.map((owner) => [owner.id, owner] as const))]);
  return Object.fromEntries(
    AREAS.map((area): [Area, AreaOwner[]] => {
      const assigned = (configured[area] ?? []).flatMap((id) => {
        const person = people.get(id);
        return person ? [{ ...person, assigned: true }] : [];
      });
      if (assigned.length) return [area, assigned];
      const counts = new Map<string, number>();
      tasks.filter((task) => task.area === area).forEach((task) => task.owners.forEach((owner) => counts.set(owner.id, (counts.get(owner.id) ?? 0) + 1)));
      const [top] = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      return [area, top ? [{ ...people.get(top[0])!, assigned: false }] : []];
    }),
  ) as Record<Area, AreaOwner[]>;
}
