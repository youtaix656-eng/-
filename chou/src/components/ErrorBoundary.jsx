import React from 'react';

// 落ちても行き止まりにしない（提案23）。受け皿が無いと、1か所落ちただけで
// 下部ナビごと消えて、再読み込みしか手が無くなる（鏡で実際に踏んだ）。
//
// 決めていること
//  - **人を責めない。** 落ちたのはアプリの側で、操作の誤りではない。
//  - **記録は消えない**と必ず書く（いちばん不安になるところ）。
//  - エラーは**端末の中だけ**に残す（`onError` が useStore の `logError` を呼ぶ）。

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { failed: true, message: error && error.message ? error.message : '' };
  }

  componentDidCatch(error) {
    if (typeof this.props.onError === 'function') this.props.onError(this.props.where || '画面', error);
  }

  reset = () => {
    this.setState({ failed: false, message: '' });
    if (typeof this.props.onReset === 'function') this.props.onReset();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="page">
        <div className="page-head">
          <h1>この画面をうまく出せませんでした</h1>
          <p className="muted">
            アプリの側の不具合です。あなたの操作が悪かったわけではありません。
            <strong>記録は消えていません。</strong>
          </p>
        </div>
        <div className="notice">
          <p>いったん別の画面へ戻ると、そのまま使えることがほとんどです。</p>
          <button type="button" className="solid" onClick={this.reset}>
            戻る
          </button>
        </div>
        {this.state.message && <p className="muted small">出たエラー：{this.state.message}</p>}
        <p className="muted small">
          このエラーは、この端末の中だけに残ります（設定の「エラーの記録」で見られます）。どこへも送りません。
        </p>
      </div>
    );
  }
}
