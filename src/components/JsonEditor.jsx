/**
 * JsonEditor — 带 JSON 语法高亮的编辑器
 * 左侧可编辑 textarea，右侧实时渲染高亮预览（可折叠）
 */
import { useState, useCallback } from 'react';
import styles from './JsonEditor.module.css';

function highlight(json) {
  if (!json) return '';
  const escaped = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(\.\d+)?([eE][+-]?\d+)?|[{}[\],])/g,
    (match) => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) return `<span class="jk">${match}</span>`;
        return `<span class="js">${match}</span>`;
      }
      if (/true|false/.test(match)) return `<span class="jb">${match}</span>`;
      if (/null/.test(match)) return `<span class="jn">${match}</span>`;
      if (/[{}[\]]/.test(match)) return `<span class="jbr">${match}</span>`;
      if (/,/.test(match)) return `<span class="jc">${match}</span>`;
      return `<span class="jnum">${match}</span>`;
    }
  );
}

function tryFormat(str) {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

export default function JsonEditor({ value, onChange, placeholder, rows = 8 }) {
  const [showPreview, setShowPreview] = useState(true);
  const [error, setError] = useState('');

  const handleChange = useCallback((e) => {
    const v = e.target.value;
    onChange(v);
    try {
      if (v.trim()) JSON.parse(v);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [onChange]);

  const handleFormat = () => {
    const formatted = tryFormat(value);
    onChange(formatted);
    try { JSON.parse(formatted); setError(''); } catch (err) { setError(err.message); }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <span className={styles.label}>JSON</span>
        {error && <span className={styles.errMsg}>⚠ {error}</span>}
        <div className={styles.actions}>
          <button className={styles.btn} onClick={handleFormat} title="格式化 JSON">Format</button>
          <button
            className={`${styles.btn} ${showPreview ? styles.btnActive : ''}`}
            onClick={() => setShowPreview(v => !v)}
            title="切换高亮预览"
          >Preview</button>
        </div>
      </div>

      <div className={`${styles.body} ${showPreview ? styles.split : ''}`}>
        <textarea
          className={`${styles.editor} ${error ? styles.editorError : ''}`}
          value={value || ''}
          onChange={handleChange}
          placeholder={placeholder || '{\n  "key": "value"\n}'}
          rows={rows}
          spellCheck={false}
        />
        {showPreview && (
          <div className={styles.preview}>
            <pre
              className={styles.preCode}
              dangerouslySetInnerHTML={{ __html: highlight(value) || `<span class="jn">{}</span>` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
