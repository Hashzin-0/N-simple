import { notFound } from 'next/navigation';
import NsimpleApp from '@/components/NsimpleApp';
import { TAB_BY_TOOL_ROUTE } from '@/lib/toolRoutes';

export default async function ToolPage({ params, searchParams }: { params: Promise<{ tool: string }>; searchParams: Promise<{ cultura?: string }> }) {
  const { tool } = await params;
  const { cultura } = await searchParams;
  const initialTab = tool === 'produtividade' && cultura === 'soja' ? 'soja' : TAB_BY_TOOL_ROUTE[tool];
  if (!initialTab) notFound();

  return <NsimpleApp initialTab={initialTab} standaloneToolPage />;
}
