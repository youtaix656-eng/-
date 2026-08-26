"""YouTube動画のURLから文字起こしを取得して表示するStreamlitアプリ。"""

import glob
import os
import re
import subprocess
import tempfile

import requests
import streamlit as st
import yt_dlp
from openai import OpenAI
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api import CouldNotRetrieveTranscript, NoTranscriptFound, RequestBlocked

DEFAULT_TEXT_MODEL = os.environ.get("OPENAI_TEXT_MODEL", "gpt-5.4")
DEFAULT_TRANSCRIBE_MODEL = os.environ.get("OPENAI_TRANSCRIBE_MODEL", "gpt-4o-transcribe")

SEGMENT_SECONDS = 1200  # 音声を20分ごとに分割する（長い動画でもAPIの1ファイル上限を超えないように）
AUDIO_BITRATE_KBPS = 128  # 文字起こし精度を優先した音質
MAX_CHUNK_BYTES = 24 * 1024 * 1024  # 文字起こしAPIの上限(25MB)に余裕を持たせる
CLEANUP_CHUNK_CHARS = 3000  # 誤字脱字修正を1回のAPI呼び出しにかける最大文字数

LANGUAGE_OPTIONS = {
    "自動判定": None,
    "日本語": "ja",
    "英語": "en",
}

CLEANUP_SYSTEM_PROMPT = (
    "あなたは日本語の文字起こしの校正者です。渡された文字起こしテキストの"
    "誤字脱字・誤変換・聞き取りミスを修正し、読みやすいように句読点を補ってください。"
    "内容の要約・省略・言い換えや、新しい情報の追加は絶対にしないでください。"
    "話されている内容と語順はそのまま保持し、表記の誤りだけを直してください。"
    "出力は修正後の本文のみとし、前置きや説明を含めないでください。"
)
CLEANUP_SPEAKER_NOTE = (
    "各行の先頭にある「話者A:」のような話者ラベルは変更せず、そのまま残してください。"
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


def download_audio(url: str, tmpdir: str) -> str:
    """yt-dlpで動画から音声のみをダウンロードする。"""
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": os.path.join(tmpdir, "source.%(ext)s"),
        "quiet": True,
        "noprogress": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        return ydl.prepare_filename(info)


def split_audio_into_chunks(source_path: str, out_dir: str) -> list[str]:
    """ffmpegで音声をmp3(モノラル・指定ビットレート)に変換しつつ、一定時間ごとに分割する。
    1ファイルが短い動画では結果的に1個だけ生成される。"""
    pattern = os.path.join(out_dir, "chunk%03d.mp3")
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            source_path,
            "-vn",
            "-ac",
            "1",
            "-b:a",
            f"{AUDIO_BITRATE_KBPS}k",
            "-f",
            "segment",
            "-segment_time",
            str(SEGMENT_SECONDS),
            "-reset_timestamps",
            "1",
            pattern,
        ],
        check=True,
        capture_output=True,
    )
    chunk_paths = sorted(glob.glob(os.path.join(out_dir, "chunk*.mp3")))
    if not chunk_paths:
        raise RuntimeError("音声の変換・分割に失敗しました。")
    return chunk_paths


def transcribe_audio_chunks(
    chunk_paths: list[str],
    openai_api_key: str,
    title: str,
    language: str | None,
    diarize: bool,
) -> tuple[str, bool]:
    """音声チャンクを順番に文字起こしし、結合する。戻り値は(文字起こし結果, 話者分離を適用したか)。
    話者分離は複数チャンクにまたがると話者ラベルの一貫性が保てないため、
    チャンクが1つ（＝動画がSEGMENT_SECONDS以下）のときのみ使用する。"""
    client = OpenAI(api_key=openai_api_key)
    use_diarize = diarize and len(chunk_paths) == 1

    texts = []
    previous_tail = ""
    for chunk_path in chunk_paths:
        if os.path.getsize(chunk_path) > MAX_CHUNK_BYTES:
            raise RuntimeError(
                "動画が長すぎるため文字起こしできません（1チャンクが25MBを超えました）。"
                "短い動画でお試しください。"
            )

        with open(chunk_path, "rb") as f:
            kwargs = {"file": f}
            if language:
                kwargs["language"] = language

            if use_diarize:
                kwargs["model"] = "gpt-4o-transcribe-diarize"
                kwargs["response_format"] = "diarized_json"
                kwargs["chunking_strategy"] = "auto"
                transcription = client.audio.transcriptions.create(**kwargs)
                lines = [f"話者{seg.speaker}: {seg.text}" for seg in transcription.segments]
                texts.append("\n".join(lines))
            else:
                kwargs["model"] = DEFAULT_TRANSCRIBE_MODEL
                prompt = f"{title} {previous_tail}".strip() if previous_tail else title
                kwargs["prompt"] = prompt
                transcription = client.audio.transcriptions.create(**kwargs)
                texts.append(transcription.text)
                previous_tail = transcription.text[-200:]

    joiner = "\n" if use_diarize else " "
    return joiner.join(texts), use_diarize


def fetch_transcript_via_audio(
    url: str,
    openai_api_key: str,
    title: str,
    language: str | None,
    diarize: bool,
) -> tuple[str, bool]:
    """字幕がない場合のフォールバック。yt-dlpで音声を取得し、必要なら分割して文字起こしする。"""
    with tempfile.TemporaryDirectory() as tmpdir:
        source_path = download_audio(url, tmpdir)
        chunk_paths = split_audio_into_chunks(source_path, tmpdir)
        return transcribe_audio_chunks(chunk_paths, openai_api_key, title, language, diarize)


def chunk_text(text: str, max_chars: int) -> list[str]:
    """文末（。！？）や改行を区切りとして、指定文字数以内のかたまりに分割する。"""
    sentences = re.split(r"(?<=[。！？\n])", text)
    chunks = []
    current = ""
    for sentence in sentences:
        if current and len(current) + len(sentence) > max_chars:
            chunks.append(current)
            current = sentence
        else:
            current += sentence
    if current:
        chunks.append(current)
    return chunks


def clean_transcript_with_openai(
    api_key: str, model: str, title: str, transcript_text: str, has_speaker_labels: bool = False
) -> str:
    """誤字脱字・句読点を自動修正する。要約や内容の変更は行わない。
    動画タイトルを文脈として渡し、固有名詞の修正精度を上げる。
    長い文章は分割して修正し、つなぎ合わせる。"""
    client = OpenAI(api_key=api_key)
    system_prompt = CLEANUP_SYSTEM_PROMPT
    if has_speaker_labels:
        system_prompt += CLEANUP_SPEAKER_NOTE

    cleaned_parts = []
    for chunk in chunk_text(transcript_text, CLEANUP_CHUNK_CHARS):
        response = client.chat.completions.create(
            model=model,
            max_tokens=4096,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"動画タイトル（固有名詞の参考にしてください）: {title}\n\n文字起こし:\n{chunk}",
                },
            ],
        )
        cleaned_parts.append(response.choices[0].message.content.strip())
    return "".join(cleaned_parts)


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

col1, col2 = st.columns(2)
with col1:
    language_choice = st.selectbox(
        "音声からの文字起こしの言語（分かる場合に指定すると精度が上がります）",
        options=list(LANGUAGE_OPTIONS.keys()),
    )
with col2:
    diarize_enabled = st.checkbox(
        "話者ごとに分けて表示する（複数人の会話向け・実験的機能）", value=False
    )

run = st.button("取得", type="primary", disabled=not openai_api_key)

if run:
    st.session_state.pop("result", None)
    video_id = extract_video_id(url or "")
    if not video_id:
        st.error("有効なYouTubeのURLを入力してください。")
    else:
        title = fetch_video_title(url)
        language = LANGUAGE_OPTIONS[language_choice]
        transcript_text = None
        has_speaker_labels = False

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
                    transcript_text, has_speaker_labels = fetch_transcript_via_audio(
                        url, openai_api_key, title, language, diarize_enabled
                    )
                    if not transcript_text or not transcript_text.strip():
                        raise RuntimeError("音声から文字を検出できませんでした。")
                    if diarize_enabled and not has_speaker_labels:
                        st.info(
                            "動画が長いため、話者分離ではなく通常の文字起こしになりました"
                            "（話者分離は約20分以内の動画のみ対応）。"
                        )
                except Exception as e:
                    with st.spinner(
                        "音声からの文字起こしに失敗したため、自動生成字幕を確認しています..."
                    ):
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
                        openai_api_key, DEFAULT_TEXT_MODEL, title, transcript_text, has_speaker_labels
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
