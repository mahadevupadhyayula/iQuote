import { notFound } from 'next/navigation';

import { WorkspaceLayout } from '@/components/app-shell/workspace-layout';
import { FixtureStageRenderer } from '@/components/workflow-shell/fixture-stage-renderer';
import {
  generateQuoteWorkflowShellFixture,
  intakeWorkflowShellFixture,
  resolveExceptionsWorkflowShellFixture,
  reviewWorkflowShellFixture,
} from '@/lib/fixtures/workflow-shell';
import type { WorkflowShellFixture, WorkflowShellStageId } from '@/lib/fixtures/workflow-shell';

const workflowShellFixtures = {
  intake: intakeWorkflowShellFixture,
  review: reviewWorkflowShellFixture,
  'resolve-exceptions': resolveExceptionsWorkflowShellFixture,
  'generate-quote': generateQuoteWorkflowShellFixture,
} satisfies Record<WorkflowShellStageId, WorkflowShellFixture>;

interface WorkflowShellFixturePageProps {
  params: Promise<{ stage: string }>;
}

export function generateStaticParams() {
  return Object.keys(workflowShellFixtures).map((stage) => ({ stage }));
}

export default async function WorkflowShellFixturePage({ params }: WorkflowShellFixturePageProps) {
  const { stage } = await params;
  const fixture = workflowShellFixtures[stage as WorkflowShellStageId];

  if (!fixture) notFound();

  return (
    <WorkspaceLayout currentStep={fixture.currentStageId} contentClassName="pb-12">
      <FixtureStageRenderer fixture={fixture} />
    </WorkspaceLayout>
  );
}
