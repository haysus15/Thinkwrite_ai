import type { Chamber } from "./extractor";
import { localRemove, localSet, syncGet, syncSet } from "./runtime";

export type { Chamber };

export type DomainAssignment = {
  chamber: Chamber;
  assignedAt: string;
  isPaused: boolean;
};

export type DomainMap = Record<string, DomainAssignment>;

const STORAGE_KEY = "domainAssignments";

const defaultAssignment = (): DomainAssignment => ({
  chamber: "general",
  assignedAt: new Date().toISOString(),
  isPaused: false,
});

async function readMap(): Promise<DomainMap> {
  const stored = await syncGet<Record<string, unknown>>(STORAGE_KEY);
  const map = stored[STORAGE_KEY];
  if (!map || typeof map !== "object") {
    return {};
  }
  return map as DomainMap;
}

async function writeMap(map: DomainMap): Promise<void> {
  await syncSet({ [STORAGE_KEY]: map });
}

export async function getDomainAssignment(hostname: string): Promise<DomainAssignment> {
  const map = await readMap();
  const assignment = map[hostname];
  if (!assignment) return defaultAssignment();

  return {
    chamber: assignment.chamber || "general",
    assignedAt: assignment.assignedAt || new Date().toISOString(),
    isPaused: Boolean(assignment.isPaused),
  };
}

export async function setDomainAssignment(hostname: string, chamber: Chamber): Promise<void> {
  const map = await readMap();
  const prev = map[hostname];
  map[hostname] = {
    chamber,
    assignedAt: prev?.assignedAt || new Date().toISOString(),
    isPaused: prev?.isPaused || false,
  };
  await writeMap(map);
}

export async function pauseDomain(hostname: string): Promise<void> {
  const map = await readMap();
  const prev = map[hostname] || defaultAssignment();
  map[hostname] = {
    ...prev,
    isPaused: true,
  };
  await writeMap(map);
  await localSet({ [`paused:${hostname}`]: true });
}

export async function resumeDomain(hostname: string): Promise<void> {
  const map = await readMap();
  const prev = map[hostname] || defaultAssignment();
  map[hostname] = {
    ...prev,
    isPaused: false,
  };
  await writeMap(map);
  await localSet({ [`paused:${hostname}`]: false });
}

export async function getAllAssignments(): Promise<DomainMap> {
  return readMap();
}

export async function removeDomainAssignment(hostname: string): Promise<void> {
  const map = await readMap();
  delete map[hostname];
  await writeMap(map);
  await localRemove(`paused:${hostname}`);
}
