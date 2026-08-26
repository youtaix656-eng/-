"""YouTube動画のURLから文字起こしを取得して表示するStreamlitアプリ。"""

import os
import re
import tempfile

import requests
import streamlit as st
import yt_dlp
from openai import OpenAI
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api import CouldNotRetrieveTranscript, NoTranscriptFound, RequestBlocked

MAX_WHISPER_BYTES = 24 * 1024 * 1024  # Whisper APIの上限(25MB)に余裕を持たせる
DEFAULT_TEXT_MODEL = os.environ.get("OPENAI_TEXT_MODEL", "gpt-5.4-mini")
DEFAULT_TRANSCRIBE_MODEL = os.environ.get("OPENAI_TRANSCRIBE_MODEL", "gpt-4o-transcribe")

CLEANUP_SYSTEM_PROMPT = (
    "あなたは日本語の文字起こしの校正者です。渡された文字起こしテキストの"
    "誤字脱字・誤変換・聞き取りミスを修正し、読みやすいように句読点を補ってください。"
    "内容の要約・省略・言い換えや、新しい情報の追加は絶対にしないでください。"
    "話されている内容と語順はそのまま保持し、表記の誤りだけを直してください。"
    "出力は修正後の本文のみとし、前置きや説明を含めないでください。"
)

VIDEO_ID_PATTERNS = [
    r"(?:v=|/shorts/|/embed/|/live/)([0-9A-Za-z_-]{11})",
    r"youtu\.be/([0-9A-Za-z_-]{11})",
]


def extract_video_id(url: str) -> str | None:
    for pattern in VIDEO_ID_PATTERNS:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def fetch_video_title(url: str) -> str:
    try:
        resp = requests.get(
            "https://www.youtube.com/oembed",
            params={"url": url, "format": "json"},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json().get("title", "YouTube動画")
    except Exception:
        return "YouTube動画"


def fetch_manual_captions(video_id: str) -> str | None:
    """手動作成された字幕のみを取得する（自動生成字幕は精度が低いため対象外）。
    日本語優先、なければ英語。手動字幕が存在しない場合はNoneを返す。"""
    api = YouTubeTranscriptApi()
    transcript_list = api.list(video_id)
    try:
        transcript = transcript_list.find_manually_created_transcript(
            ["ja", "ja-JP", "en", "en-US"]
        )
    except NoTranscriptFound:
        return None
    fetched = transcript.fetch()
    return " ".join(snippet.text for snippet in fetched)


def fetch_auto_captions(video_id: str) -> str | None:
    """自動生成字幕を取得する（手動字幕・音声文字起こしの両方が使えないときの最終手段）。"""
    try:
        api = YouTubeTranscriptApi()
        fetched = api.fetch(video_id, languages=["ja", "ja-JP", "en", "en-US"])
        return " ".join(snippet.text for snippet in fetched)
    except CouldNotRetrieveTranscript:
        return None


def fetch_transcript_via_whisper(url: str, openai_api_key: str, title: str) -> str:
    """字幕がない場合のフォールバック。yt-dlpで音声のみ取得し、文字起こしAPIで文字起こしする。
    動画タイトルをプロンプトとして渡し、固有名詞の誤認識を減らす。"""
    with tempfile.TemporaryDirectory() as tmpdir:
        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": os.path.join(tmpdir, "audio.%(ext)s"),
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "64",
                }
            ],
            "quiet": True,
            "noprogress": True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        mp3_path = os.path.join(tmpdir, "audio.mp3")
        if not os.path.exists(mp3_path):
            raise RuntimeError("音声のダウンロードに失敗しました。")

        if os.path.getsize(mp3_path) > MAX_WHISPER_BYTES:
            raise RuntimeError(
                "動画が長すぎるため文字起こしできません（文字起こしAPIは25MBまで）。"
                "短い動画でお試しください。"
            )

        client = OpenAI(api_key=openai_api_key)
        with open(mp3_path, "rb") as f:
            transcription = client.audio.transcriptions.create(
                model=DEFAULT_TRANSCRIBE_MODEL,
                file=f,
                prompt=title,
            )
        return transcription.text


def clean_transcript_with_openai(api_key: str, model: str, title: str, transcript_text: str) -> str:
    """誤字脱字・句読点を自動修正する。要約や内容の変更は行わない。
    動画タイトルを文脈として渡し、固有名詞の修正精度を上げる。"""
    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": CLEANUP_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"動画タイトル（固有名詞の参考にしてください）: {title}\n\n文字起こし:\n{transcript_text}",
            },
        ],
    )
    return response.choices[0].message.content.strip()


def sanitize_filename(name: str) -> str:
    return re.sub(r'[\\/:*?"<>|]', "_", name).strip() or "transcript"


st.set_page_config(page_title="YouTube文字起こし", page_icon="📝", layout="wide")

st.title("📝 YouTube 文字起こしアプリ")
st.caption("YouTubeのURLを貼ると、文字起こしを取得して表示します。")

raw_openai_api_key = os.environ.get("OPENAI_API_KEY", "").strip()
openai_api_key = raw_openai_api_key if raw_openai_api_key.isascii() else None

if not raw_openai_api_key:
    st.error("環境変数 `OPENAI_API_KEY` が設定されていません。設定してからアプリを再起動してください。")
elif not raw_openai_api_key.isascii():
    st.error(
        "APIキーに全角文字やスマート引用符など、使用できない文字が含まれているようです。"
        "Streamlit CloudのSecretsを開き、APIキーを一度削除してから貼り付け直してください"
        "（前後の引用符は半角の \" を使い、スマートフォンの自動修正機能はオフにしてください）。"
    )

url = st.text_input("YouTube動画のURL", placeholder="https://www.youtube.com/watch?v=...")
run = st.button("取得", type="primary", disabled=not openai_api_key)

if run:
    st.session_state.pop("result", None)
    video_id = extract_video_id(url or "")
    if not video_id:
        st.error("有効なYouTubeのURLを入力してください。")
    else:
        title = fetch_video_title(url)
        transcript_text = None

        with st.spinner("手動作成された字幕を確認しています..."):
            try:
                transcript_text = fetch_manual_captions(video_id)
            except RequestBlocked:
                st.error(
                    "YouTube側からのアクセス制限（IPブロック）により字幕を取得できませんでした。"
                    "時間を置いて再度お試しください。"
                )
            except CouldNotRetrieveTranscript:
                pass
            except Exception as e:
                st.error(f"字幕の取得中にエラーが発生しました: {e}")

        if transcript_text is None:
            with st.spinner(
                "手動字幕が見つからないため、音声から文字起こししています（数分かかることがあります）..."
            ):
                try:
                    transcript_text = fetch_transcript_via_whisper(url, openai_api_key, title)
                except Exception as e:
                    with st.spinner("音声からの文字起こしに失敗したため、自動生成字幕を確認しています..."):
                        transcript_text = fetch_auto_captions(video_id)
                    if transcript_text:
                        st.warning(
                            "音声からの文字起こしに失敗したため、精度の低い自動生成字幕を"
                            f"使用しています（エラー: {e}）。"
                        )
                    else:
                        st.error(f"文字起こしに失敗しました: {e}")

        if transcript_text:
            with st.spinner("誤字脱字を修正しています..."):
                try:
                    transcript_text = clean_transcript_with_openai(
                        openai_api_key, DEFAULT_TEXT_MODEL, title, transcript_text
                    )
                except Exception as e:
                    st.warning(f"誤字脱字の自動修正に失敗したため、元の文字起こしを表示します: {e}")

            st.session_state["result"] = {
                "title": title,
                "url": url,
                "transcript": transcript_text,
            }

if "result" in st.session_state:
    result = st.session_state["result"]

    st.subheader(f"🎬 {result['title']}")
    st.markdown(f"[{result['url']}]({result['url']})")

    st.markdown("### 文字起こし")
    st.code(result["transcript"], language="text", wrap_lines=True)

    st.download_button(
        label="テキストファイルをダウンロード",
        data=result["transcript"].encode("utf-8"),
        file_name=f"{sanitize_filename(result['title'])}.txt",
        mime="text/plain",
    )
