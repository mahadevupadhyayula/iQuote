import { WorkspaceLayout } from '@/components/app-shell/workspace-layout';
import { FixtureStageRenderer } from '@/components/workflow-shell/fixture-stage-renderer';
import {
  generateQuoteWorkflowShellFixture,
  intakeWorkflowShellFixture,
  resolveExceptionsWorkflowShellFixture,
  reviewWorkflowShellFixture,
  type WorkflowShellFixture,
  type WorkflowShellStageId,
} from '@/lib/fixtures/workflow-shell';

const previewFixtures = {
  intake: intakeWorkflowShellFixture,
  review: reviewWorkflowShellFixture,
  'resolve-exceptions': resolveExceptionsWorkflowShellFixture,
  'generate-quote': generateQuoteWorkflowShellFixture,
} satisfies Record<WorkflowShellStageId, WorkflowShellFixture>;

const defaultStage = 'intake' satisfies WorkflowShellStageId;

interface WorkspacePreviewPageProps {
  searchParams?: Promise<{
    stage?: string | string[];
  }>;
}

function getRequestedStage(stage: string | string[] | undefined) {
  return Array.isArray(stage) ? stage[0] : stage;
}

function isWorkflowShellStageId(stage: string | undefined): stage is WorkflowShellStageId {
  return Boolean(stage && stage in previewFixtures);
}

export default async function WorkspacePreviewPage({ searchParams }: WorkspacePreviewPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedStage = getRequestedStage(resolvedSearchParams?.stage);
  const selectedStage = isWorkflowShellStageId(requestedStage) ? requestedStage : defaultStage;
  const fixture = previewFixtures[selectedStage];

  return (
    <WorkspaceLayout currentStep={fixture.currentStageId}>
      {requestedStage && requestedStage !== selectedStage ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Unknown preview stage requested. Rendering the safe intake fixture instead.
        </p>
      ) : null}
      <FixtureStageRenderer fixture={fixture} />
    </WorkspaceLayout>
  );
}
