// One Monaco model per open source tab, named by the file's absolute path. A model keeps
// the text, the undo history and (through @monaco-editor/react) the view state of its file
// while other tabs are shown.
import * as monaco from 'monaco-editor';
import path from 'path-browserify';

/** The model path (a file URI) of a project file. */
export function modelPath(projectPath: string, filePath: string) {
  return monaco.Uri.file(path.join(projectPath, filePath)).toString();
}

/** Drop the model of a closed tab, so that opening the file again starts from the disk. */
export function disposeModel(projectPath: string, filePath: string) {
  monaco.editor.getModel(monaco.Uri.parse(modelPath(projectPath, filePath)))?.dispose();
}
