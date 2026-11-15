import { notFound } from 'next/navigation';
import NsimpleApp from '@/components/NsimpleApp';
import { TAB_BY_TOOL_ROUTE } from '@/lib/toolRoutes';

export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  const initialTab = TAB_BY_TOOL_ROUTE[tool];
  if (!initialTab) notFound();

  return <NsimpleApp initialTab={initialTab} standaloneToolPage />;
}
