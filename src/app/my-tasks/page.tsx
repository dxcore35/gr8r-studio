import type { Metadata } from 'next';
import { Gr8rShell } from '@/components/gr8r-shell/gr8r-shell';
import type { TaskListScenario } from '@/features/tasks';
import { MyTasksView } from './_components/my-tasks-view';

export const metadata: Metadata = {
  title: 'My tasks',
};

const scenarios: readonly TaskListScenario[] = ['populated', 'empty', 'loading', 'error'];

function isScenario(value: string | string[] | undefined): value is TaskListScenario {
  return typeof value === 'string' && scenarios.includes(value as TaskListScenario);
}

interface MyTasksPageProps {
  searchParams: Promise<{ scenario?: string | string[] }>;
}

export default async function MyTasksPage({ searchParams }: MyTasksPageProps) {
  const params = await searchParams;
  const scenario = isScenario(params.scenario) ? params.scenario : 'populated';

  return (
    <Gr8rShell>
      <MyTasksView key={scenario} scenario={scenario} />
    </Gr8rShell>
  );
}
