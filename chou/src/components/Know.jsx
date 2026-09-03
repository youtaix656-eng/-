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
          <button type="button" onClick={() => onGo('digest')}>
            <strong>まとめて見る</strong>
            <span className="muted small">
              訂正・裏が取れていない主張・食い違い・扱わないこと・出典を、素材をまたいで横に並べます。
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onGo('diseases')}>
            <strong>お腹の病気の読み物</strong>
            <span className="muted small">
              名前が挙がることのある病気の説明。当てはめる仕掛けは作っていません。
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onGo('ibscare')}>
            <strong>型ごとにできること</strong>
            <span className="muted small">
              下痢・便秘・混合・分類不能。型は自分で選ぶだけで、記録から当てません。
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onGo('breathing')}>
            <strong>お腹の力を抜く</strong>
            <span className="muted small">
              お腹で息をする・なでる。やめどきを先に置いています。
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onGo('eatingout')}>
            <strong>外で食べるときの選び方</strong>
            <span className="muted small">
              買うときに表示のどこを見るか。お店や商品の名前は持ちません。
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onGo('flora')}>
            <strong>腸内フローラの言葉</strong>
            <span className="muted small">
              よく出てくる言葉の説明。あなたの菌がどうなっているかは分かりません。
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onGo('visits')}>
            <strong>通院</strong>
            <span className="muted small">
              予定・聞きたいこと・言われたこと。通知は鳴らしません。
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onGo('periods')}>
            <strong>いつもと違う期間</strong>
            <span className="muted small">
              旅行・薬が変わった・生理など。印をつけるだけで、判定はしません。
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onGo('ibs')}>
            <strong>過敏性腸症候群のこと</strong>
            <span className="muted small">
              検査で異常が出ないこと、分け方、出典が挙げる手当て。記録から型は当てません。
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
          <button type="button" onClick={() => onGo('prebiotics')}>
            <strong>善玉菌の餌</strong>
            <span className="muted small">
              水溶性食物繊維・オリゴ糖・レジスタントスターチ。低FODMAP と目的が反対を向く所も並べます。
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onGo('butyrate')}>
            <strong>酪酸菌と短鎖脂肪酸</strong>
            <span className="muted small">
              出典が挙げるはたらきと、出典自身が取り下げた説（痩せ菌・デブ菌）を並べます。
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onGo('morning')}>
            <strong>朝のリズムと排便</strong>
            <span className="muted small">
              出典が挙げる特徴とやってみること。出なくても責めない、が芯です。
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onGo('scared')}>
            <strong>名指しされた食べもの</strong>
            <span className="muted small">
              「猛毒」「食べるな」と言われるもの。このアプリは食べものに札を貼りません。
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onGo('protein')}>
            <strong>タンパク質と腸</strong>
            <span className="muted small">
              出典が挙げる目安と、ためしにやめてみる（小麦・乳製品）。グラム数は計算しません。
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onGo('fasting')}>
            <strong>断食・空腹の時間</strong>
            <span className="muted small">
              このアプリは勧めていません。やめどきと、そのままにできない主張を先に並べます。
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onGo('otc')}>
            <strong>市販薬とのつきあい方</strong>
            <span className="muted small">
              下痢止め・胃薬・痛み止め。飲み合わせは判定しません。使った日は記録に残せます。
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onGo('habits')}>
            <strong>胃腸の習慣</strong>
            <span className="muted small">
              傷つけるとされる7つ・整えるとされる4つ。食物繊維の言い分が割れる所も並べます。
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
