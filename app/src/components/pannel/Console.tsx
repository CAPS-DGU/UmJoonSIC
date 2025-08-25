export default function Console() {
  return (
    <div className="bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 flex flex-col h-full overflow-hidden">
      <h2 className="font-semibold text-sm p-2 border-b border-gray-300 dark:border-gray-700">
        Console
      </h2>
      <div className="flex-1 overflow-auto p-2">
        <p className="text-gray-400 text-sm">No output available.</p>
      </div>
    </div>
  );
}
