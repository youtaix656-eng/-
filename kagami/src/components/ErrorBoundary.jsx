import React from 'react';
import { GLYPHS } from '../data/glyphs.js';

/**
 * 画面のどこかで落ちた時の受け皿。
 *
 * **落ちても行き止まりにしない。** これが無いと React が画面ごと外すので、
 * 下部ナビまで消えて真っ白になり、再読み込みしか手が無くなる（実際に踏んだ）。
 * 端末内のデータが原因のことがあるので、**消さずに持ち出す口**も必ず出す。
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prev) {
    // 別の画面へ移ったら、また出しなおす（同じ画面に閉じ込めない）
    if (prev.viewKey !== this.props.viewKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <>
        <div className="head">
          <h1>この画面を出せませんでした</h1>
          <p>ほかの画面は今までどおり使えます。</p>
        </div>
        <div className="note warn">
          端末に入っているデータの形が合わないと、ここで止まることがあります。
          <strong>データは消していません。</strong>
          設定から書き出して残したうえで、消すかどうかを決められます。
        </div>
        <div className="card quiet">
          <p className="tiny" style={{ wordBreak: 'break-word' }}>
            {GLYPHS.reference} {String(this.state.error && this.state.error.message).slice(0, 200)}
          </p>
        </div>
        <div className="row end">
          <button className="ghost" onClick={() => this.setState({ error: null })}>
            もう一度ひらく
          </button>
          {this.props.onSettings && (
            <button className="ghost" onClick={() => this.props.onSettings()}>
              設定（書き出し）へ
            </button>
          )}
          <button className="primary" onClick={() => this.props.onHome && this.props.onHome()}>
            ホームへもどる
          </button>
        </div>
      </>
    );
  }
}
