/** 상단 툴바 */
import "../../styles/ToolBar.css";

export default function ToolBar() {
  return (
    <div className="toolbar">
      <button className="toolbar-button">파일</button>
      <button className="toolbar-button">편집</button>
      <button className="toolbar-button">보기</button>
      <button className="toolbar-button">도움말</button>

      <input
        type="text"
        placeholder="Currunt File Path"
        className="toolbar-search"
      />
    </div>
  );
}
