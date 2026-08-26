# YouTube 文字起こしアプリ

YouTubeのURLを貼ると文字起こしを取得して表示するStreamlitアプリです。
字幕がある動画はそのまま取得し、字幕がない動画は音声をダウンロードして
Whisper APIで文字起こしします。取得後はAIが誤字脱字・句読点を自動修正します
（要約はしません、内容はそのまま）。

## セットアップ

```bash
cd youtube-transcript-summarizer
pip install -r requirements.txt
# 音声フォールバック(yt-dlp)を使うにはffmpegが必要
# 例: sudo apt-get install ffmpeg / brew install ffmpeg
export OPENAI_API_KEY=sk-...   # 誤字脱字修正・Whisper文字起こしの両方に必要
streamlit run app.py
```

## 使い方

1. YouTube動画のURLを入力欄に貼り付ける。
2. 「取得」ボタンを押す。
3. 字幕があればそのまま、なければ音声から文字起こしした結果が表示される
   （右上のアイコンでワンクリックコピー可能）。
4. 「テキストファイルをダウンロード」ボタンで `.txt` として保存できる。

## 処理の流れ（精度優先の順で試す）

1. URLから動画IDを抽出。
2. **手動作成された字幕**を優先的に取得（日本語優先、なければ英語）。
   自動生成字幕は精度が低いため、この段階では使わない。
3. 手動字幕がない場合、`yt-dlp` で音声のみダウンロードし、
   OpenAIの文字起こしAPI（既定 `gpt-4o-transcribe`、`OPENAI_TRANSCRIBE_MODEL` で変更可）
   で文字起こしする。動画タイトルをヒントとして渡し、固有名詞の誤認識を減らす。
4. 音声からの文字起こしにも失敗した場合、最終手段として自動生成字幕を使う
   （精度が低い旨を警告表示）。
5. 取得したテキストをOpenAIのチャットモデル（既定 `gpt-5.4-mini`、
   `OPENAI_TEXT_MODEL` で変更可）に渡し、動画タイトルを文脈として、
   誤字脱字・句読点を修正する（要約・省略はしない）。
6. 結果を画面に表示し、ダウンロードボタンを設置。

## 注意事項

- `OPENAI_API_KEY` は誤字脱字修正のため必須（未設定だと「取得」ボタンが押せない）。
- 音声からの文字起こしは1ファイル25MBまで（長い動画は非対応）。
- Streamlit Cloudにデプロイする場合、`packages.txt` の `ffmpeg` が自動でインストールされる。
