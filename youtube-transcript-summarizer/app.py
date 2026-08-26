"""YouTube動画のURLから文字起こしを取得して表示するStreamlitアプリ。"""

import os
import re
import tempfile

import requests
import streamlit as st
import yt_dlp
from openai import OpenAI
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api import CouldNotRetrieveTranscript, RequestBlocked

MAX_WHISPER_BYTES = 24 * 1024 * 1024  # Whisper APIの上限(25MB)に余裕を持たせる

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


def fetch_transcript_via_captions(video_id: str) -> str | None:
    """字幕（手動・自動生成問わず）から文字起こしを取得する。日本語優先、なければ英語。
    字幕が存在しない場合はNoneを返す。"""
    try:
        api = YouTubeTranscriptApi()
        fetched = api.fetch(video_id, languages=["ja", "ja-JP", "en", "en-US"])
        return " ".join(snippet.text for snippet in fetched)
    except CouldNotRetrieveTranscript:
        return None


def fetch_transcript_via_whisper(url: str, openai_api_key: str) -> str:
    """字幕がない場合のフォールバック。yt-dlpで音声のみ取得し、Whisper APIで文字起こしする。"""
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
                "動画が長すぎるため文字起こしできません（Whisper APIは25MBまで）。"
                "短い動画でお試しください。"
            )

        client = OpenAI(api_key=openai_api_key)
        with open(mp3_path, "rb") as f:
            transcription = client.audio.transcriptions.create(model="whisper-1", file=f)
        return transcription.text


def sanitize_filename(name: str) -> str:
    return re.sub(r'[\\/:*?"<>|]', "_", name).strip() or "transcript"


st.set_page_config(page_title="YouTube文字起こし", page_icon="📝", layout="wide")

st.title("📝 YouTube 文字起こしアプリ")
st.caption("YouTubeのURLを貼ると、文字起こしを取得して表示します。")

openai_api_key = os.environ.get("OPENAI_API_KEY", "").strip()

url = st.text_input("YouTube動画のURL", placeholder="https://www.youtube.com/watch?v=...")
run = st.button("取得", type="primary")

if run:
    st.session_state.pop("result", None)
    video_id = extract_video_id(url or "")
    if not video_id:
        st.error("有効なYouTubeのURLを入力してください。")
    else:
        transcript_text = None
        with st.spinner("字幕を取得しています..."):
            try:
                transcript_text = fetch_transcript_via_captions(video_id)
            except RequestBlocked:
                st.error(
                    "YouTube側からのアクセス制限（IPブロック）により字幕を取得できませんでした。"
                    "時間を置いて再度お試しください。"
                )
            except Exception as e:
                st.error(f"字幕の取得中にエラーが発生しました: {e}")

        if transcript_text is None:
            if not openai_api_key:
                st.error(
                    "この動画には字幕がありません。音声からの文字起こしには "
                    "環境変数 `OPENAI_API_KEY` の設定が必要です。"
                )
            else:
                with st.spinner(
                    "字幕が見つからないため、音声から文字起こししています（数分かかることがあります）..."
                ):
                    try:
                        transcript_text = fetch_transcript_via_whisper(url, openai_api_key)
                    except Exception as e:
                        st.error(f"音声からの文字起こし中にエラーが発生しました: {e}")

        if transcript_text:
            title = fetch_video_title(url)
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
