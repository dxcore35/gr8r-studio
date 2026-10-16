import type { Metadata } from 'next';
import { SidebarRail } from '@/components/arc/blocks/sidebar-rail/sidebar-rail';
import { ThemeToggle } from '@/components/theme-toggle/theme-toggle';
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
    <>
      <a className="skip-link" href="#main-content">
        Skip to tasks
      </a>
      <SidebarRail
        activeId="my-tasks"
        pageTitle="My tasks"
        topbarActions={<ThemeToggle />}
        userName="Mara Ionescu"
        userRole="Workspace owner"
        workspaceDetail="Operations"
        workspaceName="Janom"
      >
        <MyTasksView key={scenario} scenario={scenario} showScenarioPicker={process.env.NODE_ENV !== 'production'} />
      </SidebarRail>
    </>
  );
}
