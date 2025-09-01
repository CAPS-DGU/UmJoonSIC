import CodeEditor from './CodeEditor';
import TabBar from './TabBar';

export default function EditorContainer() {
  return (
    <div className="flex-1 w-full h-full">
      <TabBar />
      <CodeEditor />
    </div>
  );
}
