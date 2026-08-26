# YouTube 文字起こしアプリ

YouTubeのURLを貼ると文字起こしを取得して表示するStreamlitアプリです。
字幕がある動画はそのまま取得し、字幕がない動画は音声をダウンロードして
Whisper APIで文字起こしします。

## セットアップ

```bash
cd youtube-transcript-summarizer
pip install -r requirements.txt
# 音声フォールバック(yt-dlp)を使うにはffmpegが必要
# 例: sudo apt-get install ffmpeg / brew install ffmpeg
export OPENAI_API_KEY=sk-...   # 字幕なし動画のWhisper文字起こしに必要（任意）
streamlit run app.py
```

## 使い方

1. YouTube動画のURLを入力欄に貼り付ける。
2. 「取得」ボタンを押す。
3. 字幕があればそのまま、なければ音声から文字起こしした結果が表示される
   （右上のアイコンでワンクリックコピー可能）。
4. 「テキストファイルをダウンロード」ボタンで `.txt` として保存できる。

## 処理の流れ

1. URLから動画IDを抽出。
2. `youtube-transcript-api` で字幕取得を試みる（日本語優先、なければ英語）。
3. 字幕が存在しない場合、`yt-dlp` で音声のみダウンロードし、
   OpenAIのWhisper APIで文字起こしする。
4. 結果を画面に表示し、ダウンロードボタンを設置。

## 注意事項

- Whisper APIによる音声文字起こしは1ファイル25MBまで（長い動画は非対応）。
- `OPENAI_API_KEY` が未設定の場合、字幕がない動画は「字幕なし」エラーになる。
- Streamlit Cloudにデプロイする場合、`packages.txt` の `ffmpeg` が自動でインストールされる。
