import { useEffect, useState } from 'react';
import { actions, useStore } from './lib/useStore.js';
import { HomeView } from './components/HomeView.js';
import { SymptomForm } from './components/SymptomForm.js';
import { CareForm } from './components/CareForm.js';
import { SymptomList } from './components/SymptomList.js';
import { CareList } from './components/CareList.js';
import { SettingsView } from './components/SettingsView.js';
import type { CareRecord, SymptomRecord } from './types/index.js';

const NAV = [
  { id: 'home', label: 'ホーム', ico: '🏠' },
  { id: 'symptoms', label: '症状', ico: '📍' },
  { id: 'cares', label: '対応策', ico: '🩹' },
  { id: 'settings', label: '設定', ico: '⚙️' },
] as const;

type View = (typeof NAV)[number]['id'];

/** 入力中の画面（フォーム）。下部ナビの画面の上に重ねる */
type Editor =
  | { kind: 'symptom'; initial?: SymptomRecord }
  | { kind: 'care'; initial?: CareRecord; presetSymptomIds?: string[] }
  | null;

function isView(v: string): v is View {
  return NAV.some((n) => n.id === v);
}

export default function App() {
  const state = useStore();
  const [view, setView] = useState<View>('home');
  const [editor, setEditor] = useState<Editor>(null);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    void actions.hydrate().then(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const last = state.settings.lastView;
    if (isView(last)) setView(last);
    // 起動時に一度だけ、前に見ていた画面へ戻す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const go = (next: View) => {
    setView(next);
    setEditor(null);
    actions.setSettings({ lastView: next });
    window.scrollTo({ top: 0 });
  };
  const openEditor = (e: Editor) => {
    setEditor(e);
    window.scrollTo({ top: 0 });
  };

  if (!hydrated) {
    return <div className="app"><p className="small">読み込んでいます…</p></div>;
  }

  const renderEditor = () => {
    if (!editor) return null;
    if (editor.kind === 'symptom') {
      return (
        <>
          <h2 className="view-title">{editor.initial ? '症状を編集' : '症状を記録'}</h2>
          <SymptomForm
            initial={editor.initial}
            onCancel={() => setEditor(null)}
            onSave={(input) => {
              if (editor.initial) {
                actions.updateSymptom(editor.initial.id, input);
                setToast('症状を更新しました');
                setEditor(null);
              } else {
                const rec = actions.addSymptom(input);
                setToast('症状を記録しました');
                // 続けて対応策を記録しやすいよう、紐づけ済みの対応策フォームへ案内する
                setEditor({ kind: 'care', presetSymptomIds: [rec.id] });
                window.scrollTo({ top: 0 });
              }
            }}
          />
        </>
      );
    }
    return (
      <>
        <h2 className="view-title">{editor.initial ? '対応策を編集' : '対応策を記録'}</h2>
        {!editor.initial && editor.presetSymptomIds?.length ? (
          <p className="small">いま記録した症状に紐づけた状態です。まだ何も試していなければ「キャンセル」で戻れます。</p>
        ) : null}
        <CareForm
          initial={editor.initial}
          presetSymptomIds={editor.presetSymptomIds}
          symptoms={state.symptoms}
          quickItems={state.settings.quickCareItems}
          onCancel={() => setEditor(null)}
          onSave={(input) => {
            if (editor.initial) {
              actions.updateCare(editor.initial.id, input);
              setToast('対応策を更新しました');
            } else {
              actions.addCare(input);
              setToast('対応策を記録しました');
            }
            setEditor(null);
          }}
        />
      </>
    );
  };

  const renderView = () => {
    switch (view) {
      case 'symptoms':
        return (
          <>
            <h2 className="view-title">症状の一覧・検索</h2>
            <button type="button" className="btn primary" onClick={() => openEditor({ kind: 'symptom' })}>＋ 症状を記録</button>
            <SymptomList
              symptoms={state.symptoms}
              cares={state.cares}
              onEdit={(s) => openEditor({ kind: 'symptom', initial: s })}
              onRemove={(id) => { actions.removeSymptom(id); setToast('削除しました'); }}
              onAddCare={(id) => openEditor({ kind: 'care', presetSymptomIds: [id] })}
            />
          </>
        );
      case 'cares':
        return (
          <>
            <h2 className="view-title">対応策の一覧</h2>
            <button type="button" className="btn primary" onClick={() => openEditor({ kind: 'care' })}>＋ 対応策を記録</button>
            <CareList
              cares={state.cares}
              symptoms={state.symptoms}
              onEdit={(c) => openEditor({ kind: 'care', initial: c })}
              onRemove={(id) => { actions.removeCare(id); setToast('削除しました'); }}
            />
          </>
        );
      case 'settings':
        return (
          <SettingsView
            state={state}
            onSetQuickItems={(items) => actions.setSettings({ quickCareItems: items })}
            onImport={(s) => actions.replaceAll(s)}
            onWipe={() => void actions.wipe()}
          />
        );
      case 'home':
      default:
        return (
          <HomeView
            symptoms={state.symptoms}
            cares={state.cares}
            onNewSymptom={() => openEditor({ kind: 'symptom' })}
            onNewCare={() => openEditor({ kind: 'care' })}
            onGoSymptoms={() => go('symptoms')}
            onGoCares={() => go('cares')}
          />
        );
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>体調カルテ</h1>
        <span className="sub">端末内保存・個人用</span>
      </header>
      <main>{editor ? renderEditor() : renderView()}</main>
      {toast && <div className="toast" role="status">{toast}</div>}
      <nav className="bottom-nav" aria-label="画面の切り替え">
        {NAV.map((n) => (
          <button key={n.id} type="button" className={view === n.id && !editor ? 'on' : ''} onClick={() => go(n.id)} aria-current={view === n.id && !editor ? 'page' : undefined}>
            <span className="ico" aria-hidden="true">{n.ico}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
