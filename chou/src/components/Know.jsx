import React from 'react';
import { useFocusJump } from './useFocusJump.js';

// しらべる。読み物と道具の入口をまとめた画面。

const MAP_SEARCH = 'https://www.google.com/maps/search/?api=1&query=公衆トイレ';

export default function Know({ onGo, focus, onFocusDone }) {
  useFocusJump(focus, onFocusDone);
  return (
    <div className="view">
      <header className="view-head">
        <h1>しらべる</h1>
      </header>

      <ul className="menu" id="know-menu">
        <li>
          <button type="button" onClick={() => onGo('redflags')}>
            <strong>受診の目安</strong>
            <span className="muted small">
              医療機関で相談したほうがよいこと。数えたり、色で決めたりはしません。
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onGo('cleanup')}>
            <strong>腸のお掃除（5つ）</strong>
            <span className="muted small">
              食べ物・発酵食品・ストレス・姿勢・運動と睡眠。3つの考え方が食い違う所も並べます。
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onGo('combine')}>
            <strong>食べ合わせ（アダムスキー式）</strong>
            <span className="muted small">
              消化の速いものと遅いものを一緒に食べない、という考え方。低FODMAP と反対になる所も並べます。
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onGo('fodmap')}>
            <strong>低FODMAP の食材</strong>
            <span className="muted small">
              少なめ／量による／多め の一覧。自分のからだの結果を1件ずつ付けられます。
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onGo('probiotics')}>
            <strong>整腸剤</strong>
            <span className="muted small">
              飲んでいるものを登録して、試している期間を見ます。どれかを勧めることはしません。
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onGo('seasonings')}>
            <strong>調味料の選び方</strong>
            <span className="muted small">
              さしすせそ＋みりん・甘酒の7つ。買うときに表示のどこを見るか。
            </span>
          </button>
        </li>
        <li>
          <a className="menu-link" href={MAP_SEARCH} target="_blank" rel="noreferrer noopener">
            <strong>近くのトイレをさがす</strong>
            <span className="muted small">
              地図アプリを開くだけです。このアプリは現在地を受け取りも保存もしません
              （地図アプリの側で現在地を使うことがあります）。
            </span>
          </a>
        </li>
        <li>
          <button type="button" onClick={() => onGo('settings')}>
            <strong>このアプリのこと・書き出し</strong>
            <span className="muted small">保存されているもの、バックアップ、消しかた。</span>
          </button>
        </li>
      </ul>

      <div className="notice">
        <p>
          お腹の症状の原因はいろいろで、同じ症状でも人によって違います。
          このアプリは、その見分けをするものではありません。
          できるのは、<strong>あとで思い出せない材料を残しておくこと</strong>までです。
        </p>
      </div>
    </div>
  );
}
