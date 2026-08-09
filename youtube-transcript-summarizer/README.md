# YouTube 字幕要約アプリ

YouTubeのURLを入力すると、動画の字幕（日本語優先、なければ英語）を取得し、
Claudeで「読みやすい詳細文章」と「300〜500文字の要約」を生成するStreamlitアプリです。

## セットアップ

```bash
cd youtube-transcript-summarizer
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...
streamlit run app.py
```

## 使い方

1. YouTube動画のURLを入力欄に貼り付ける。
2. 「実行」ボタンを押す。
3. 「要約」「詳細文章」がそれぞれコピー用のコードブロックで表示される
   （右上のアイコンでワンクリックコピー可能）。
4. 「Markdownファイルをダウンロード」ボタンで、動画タイトル・URL・要約・
   詳細文章をまとめた `.md` ファイルを保存できる。

## 注意事項

- 字幕が存在しない・非公開設定などで取得できない動画はエラーメッセージを表示します。
- 使用するClaudeモデルは環境変数 `CLAUDE_MODEL` で変更可能です（未設定時は `claude-sonnet-5`）。
- 動画タイトルはYouTubeのoEmbed APIから取得します（APIキー不要）。
