export type WorkflowShellStageId = 'intake' | 'review' | 'resolve-exceptions' | 'generate-quote';

export type WorkflowShellVisualTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'primary';

export type WorkflowShellStepState = 'complete' | 'current' | 'upcoming' | 'blocked';

export type WorkflowShellChecklistItemState = 'complete' | 'current' | 'pending' | 'blocked';

export type WorkflowShellSourceIndicator = 'customer-email' | 'crm' | 'catalog' | 'contract' | 'manual-entry';

export type WorkflowShellConfidenceIndicator = 'high' | 'medium' | 'low' | 'needs-review';

export interface WorkflowShellStage {
  id: WorkflowShellStageId;
  label: string;
  description?: string;
  state: WorkflowShellStepState;
  tone?: WorkflowShellVisualTone;
}

export interface WorkflowShellChecklistItem {
  id: string;
  label: string;
  description?: string;
  state: WorkflowShellChecklistItemState;
  source?: WorkflowShellSourceIndicator;
  confidence?: WorkflowShellConfidenceIndicator;
  tone?: WorkflowShellVisualTone;
}

export interface WorkflowShellSlaTimer {
  label: string;
  dueAt: string;
  remainingLabel: string;
  tone: WorkflowShellVisualTone;
  isPaused?: boolean;
}

export interface WorkflowShellTimelineItem {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  actorLabel?: string;
  tone?: WorkflowShellVisualTone;
  source?: WorkflowShellSourceIndicator;
}

export type WorkflowShellActionVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface WorkflowShellAction {
  id: string;
  label: string;
  variant: WorkflowShellActionVariant;
  disabled?: boolean;
  helperText?: string;
}

export interface WorkflowShellFixture {
  title: string;
  subtitle?: string;
  currentStageId: WorkflowShellStageId;
  stages: readonly WorkflowShellStage[];
  checklist: readonly WorkflowShellChecklistItem[];
  slaTimer?: WorkflowShellSlaTimer;
  timeline: readonly WorkflowShellTimelineItem[];
  actions: readonly WorkflowShellAction[];
}
