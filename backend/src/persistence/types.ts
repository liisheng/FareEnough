import type { DecisionResult } from '../decisions/types.js';

export interface PersistedArtifactInput {
  artifactId: string;
  stage: string;
  actor: string;
  payload: unknown;
}

export interface PersistedEventInput {
  eventId: string;
  sequence: number;
  eventType: string;
  payload: unknown;
}

export interface PersistCompletedRunInput {
  runId: string;
  decisionId: string;
  caseId: string;
  provider: string;
  mode: 'live' | 'replay' | 'test';
  inputHash: string;
  startedAt: string;
  completedAt: string;
  artifacts: PersistedArtifactInput[];
  events: PersistedEventInput[];
  decision: DecisionResult;
}

export interface PersistCompletedRunResult {
  runId: string;
  decisionId: string;
  actionId: string | null;
  replayed: boolean;
}
