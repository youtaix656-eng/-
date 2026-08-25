// 起動画面。ウロボロスの印章。初回だけ出す。

export default function Splash({ onStart }) {
  return (
    <div className="splash fade-in">
      <img src="./ouro-seal.jpg" alt="" className="seal" />
      <h1>Ouro</h1>
      <p className="tagline">知識をつなぎ、未来をつくる。</p>

      <div style={{ maxWidth: 380, width: '100%' }}>
        <p className="muted" style={{ marginBottom: 20, lineHeight: 1.9 }}>
          Ouro はAIチャットではありません。
          <br />
          あなたが<strong style={{ color: '#fff' }}>オーナー</strong>で、
          AI社員があなたの代わりに調べ、整理し、確かめ、作ります。
          <br />
          働いた分だけ、知識が会社の資産として積み上がります。
        </p>
        <button type="button" className="btn primary block" onClick={onStart}>
          会社をはじめる
        </button>
        <p className="muted" style={{ marginTop: 14, fontSize: 12 }}>
          データは端末の中だけに保存されます。<br />
          AIエンジンはあとから接続できます（無くても動きます）。
        </p>
      </div>
    </div>
  );
}
