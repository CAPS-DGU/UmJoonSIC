import CodeEditor from '@/features/editor/CodeEditor';
import OutsideBanner from '@/features/editor/OutsideBanner';
import TabBar from '@/features/editor/TabBar';

export default function EditorContainer() {
  return (
    <div className="flex h-full w-full flex-1 flex-col">
      <TabBar />
      <OutsideBanner />
      <div className="min-h-0 flex-1">
        <CodeEditor />
      </div>
    </div>
  );
}
