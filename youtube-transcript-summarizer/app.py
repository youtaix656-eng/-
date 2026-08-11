"""YouTube動画の字幕を取得し、Claudeで詳細文章と要約を生成するStreamlitアプリ。"""

import os
import re

import anthropic
import requests
import streamlit as st
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api import CouldNotRetrieveTranscript, RequestBlocked

DEFAULT_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5")

SYSTEM_PROMPT = """あなたは優秀な編集者です。YouTube動画の字幕テキストを渡すので、次の2つを作成してください。

1. 詳細文章: 話し言葉の字幕を、意味を保ったまま読みやすい文章体に整えてください。話題の区切りが分かる場合はMarkdownの見出し（##）で章立てしてください。
2. 要約: 300〜500文字程度で、動画の内容を過不足なくまとめてください。

出力は必ず次の形式のみで返してください。前後に説明や挨拶などの余計な文章を含めないでください。

---SUMMARY-START---
(ここに要約)
---SUMMARY-END---
---DETAIL-START---
(ここに詳細文章)
---DETAIL-END---
"""

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


def fetch_transcript_text(video_id: str) -> tuple[str, str]:
    """(字幕テキスト, 言語コード) を返す。日本語優先、なければ英語。"""
    api = YouTubeTranscriptApi()
    fetched = api.fetch(video_id, languages=["ja", "ja-JP", "en", "en-US"])
    text = " ".join(snippet.text for snippet in fetched)
    return text, fetched.language_code


def summarize_with_claude(api_key: str, model: str, title: str, transcript_text: str) -> tuple[str, str]:
    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model=model,
        max_tokens=8000,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"動画タイトル: {title}\n\n字幕全文:\n{transcript_text}",
            }
        ],
    )
    raw = "".join(block.text for block in message.content if block.type == "text")

    summary_match = re.search(r"---SUMMARY-START---(.*?)---SUMMARY-END---", raw, re.DOTALL)
    detail_match = re.search(r"---DETAIL-START---(.*?)---DETAIL-END---", raw, re.DOTALL)

    if not summary_match or not detail_match:
        raise ValueError("Claudeの応答を解析できませんでした。もう一度お試しください。")

    return summary_match.group(1).strip(), detail_match.group(1).strip()


def sanitize_filename(name: str) -> str:
    return re.sub(r'[\\/:*?"<>|]', "_", name).strip() or "youtube_summary"


def build_markdown(title: str, url: str, summary: str, detail: str) -> str:
    return f"""# {title}

**URL**: {url}

## 要約

{summary}

## 詳細文章

{detail}
"""


st.set_page_config(page_title="YouTube字幕要約", page_icon="📺", layout="wide")

st.title("📺 YouTube 字幕要約アプリ")
st.caption("YouTubeのURLを入力すると、字幕から詳細文章と要約をClaudeが生成します。")

raw_api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
api_key = raw_api_key if raw_api_key.isascii() else None

if not raw_api_key:
    st.error("環境変数 `ANTHROPIC_API_KEY` が設定されていません。設定してからアプリを再起動してください。")
elif not raw_api_key.isascii():
    st.error(
        "APIキーに全角文字やスマート引用符など、使用できない文字が含まれているようです。"
        "Streamlit CloudのSecretsを開き、APIキーを一度削除してから貼り付け直してください"
        "（前後の引用符は半角の \" を使い、スマートフォンの自動修正機能はオフにしてください）。"
    )

url = st.text_input("YouTube動画のURL", placeholder="https://www.youtube.com/watch?v=...")
run = st.button("実行", type="primary", disabled=not api_key)

if run:
    st.session_state.pop("result", None)
    video_id = extract_video_id(url or "")
    if not video_id:
        st.error("有効なYouTubeのURLを入力してください。")
    else:
        with st.spinner("字幕を取得しています..."):
            try:
                transcript_text, lang_code = fetch_transcript_text(video_id)
            except RequestBlocked:
                st.error(
                    "YouTube側からのアクセス制限（IPブロック）により字幕を取得できませんでした。"
                    "サーバーのIPアドレスが一時的にブロックされている可能性があります。"
                    "時間を置いて再度お試しください。"
                )
                transcript_text = None
            except CouldNotRetrieveTranscript:
                st.error("この動画には字幕（日本語・英語）が存在しないか、取得できませんでした。")
                transcript_text = None
            except Exception as e:
                st.error(f"字幕の取得中にエラーが発生しました: {e}")
                transcript_text = None

        if transcript_text:
            title = fetch_video_title(url)
            st.info(f"字幕を取得しました（言語: {lang_code}）。要約を生成しています...")

            with st.spinner("Claudeが文章を生成しています..."):
                try:
                    summary, detail = summarize_with_claude(api_key, DEFAULT_MODEL, title, transcript_text)
                except Exception as e:
                    st.error(f"要約生成中にエラーが発生しました: {e}")
                    summary, detail = None, None

            if summary and detail:
                st.session_state["result"] = {
                    "title": title,
                    "url": url,
                    "summary": summary,
                    "detail": detail,
                }

if "result" in st.session_state:
    result = st.session_state["result"]

    st.subheader(f"🎬 {result['title']}")
    st.markdown(f"[{result['url']}]({result['url']})")

    st.markdown("### 要約")
    st.code(result["summary"], language="text", wrap_lines=True)

    st.markdown("### 詳細文章")
    st.code(result["detail"], language="text", wrap_lines=True)

    markdown_content = build_markdown(result["title"], result["url"], result["summary"], result["detail"])
    st.download_button(
        label="Markdownファイルをダウンロード",
        data=markdown_content.encode("utf-8"),
        file_name=f"{sanitize_filename(result['title'])}.md",
        mime="text/markdown",
    )
