import CodeEditor from '@/features/editor/CodeEditor';
import TabBar from '@/features/editor/TabBar';

export default function EditorContainer() {
  return (
    <div className="flex-1 w-full h-full">
      <TabBar />
      <CodeEditor />
    </div>
  );
}
