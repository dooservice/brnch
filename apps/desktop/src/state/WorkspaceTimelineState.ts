import type { ProjectBackend } from "../backend/ProjectBackend";
import type { AgentEvent, RunNotice } from "../model/AgentEvent";

type StateListener = () => void;

export interface TimelineEntry {
  readonly sequence: number;
  readonly event: AgentEvent;
}

/**
 * What each workspace's agent has done: the history from disk plus what arrives live. An event
 * that shows up twice, once from each path, is kept once.
 */
export class WorkspaceTimelineState {
  private readonly entries = new Map<string, TimelineEntry[]>();
  private readonly listeners = new Set<StateListener>();
  private stopListening: (() => void) | null = null;

  constructor(private readonly backend: ProjectBackend) {}

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  eventsOf(workspaceIdentifier: string | null): readonly TimelineEntry[] {
    return workspaceIdentifier === null ? [] : (this.entries.get(workspaceIdentifier) ?? []);
  }

  async startListening(): Promise<void> {
    this.stopListening = await this.backend.onAgentEvent((notice) => {
      this.add(notice);
      this.announce();
    });
  }

  stop(): void {
    this.stopListening?.();
    this.stopListening = null;
  }

  async loadHistory(workspaceIdentifier: string): Promise<void> {
    const known = this.eventsOf(workspaceIdentifier);
    const lastKnown = known.length === 0 ? 0 : known[known.length - 1]!.sequence;
    const notices = await this.backend.listWorkspaceEvents(workspaceIdentifier, lastKnown);
    notices.forEach((notice) => this.add(notice));
    this.announce();
  }

  private add(notice: RunNotice): void {
    const existing = this.entries.get(notice.workspaceIdentifier) ?? [];
    if (existing.some((entry) => entry.sequence === notice.sequence)) {
      return;
    }
    const event = JSON.parse(notice.eventJson) as AgentEvent;
    const next = [...existing, { sequence: notice.sequence, event }].sort(
      (first, second) => first.sequence - second.sequence,
    );
    this.entries.set(notice.workspaceIdentifier, next);
  }

  private announce(): void {
    this.listeners.forEach((listener) => listener());
  }
}
