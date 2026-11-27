package com.youtaix656.shinkyu

import android.Manifest
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * アプリ版（Android の WebView）には SpeechRecognition（Web の音声認識）が無いため、
 * 声で自己採点・声で解答・読み方の声入力が使えなかった。Android 本体の音声認識
 * （SpeechRecognizer）で1回だけ聞き取る。JS 側は src/lib/voiceCommand.js の listenOnce。
 *
 * 音声は端末の音声認識サービス（多くは Google）へ送られる場合がある＝ブラウザ版と同じく
 * 端末内保存方針の明示的な例外（画面にもそう書いてある）。
 *
 * - listen：1回聞き取り、{ text } を返す。聞き取れなければ code "no-speech" で reject。
 * - stop：聞き取りをやめる（code "aborted"）。
 */
@CapacitorPlugin(
    name = "NativeStt",
    permissions = [
        Permission(strings = [Manifest.permission.RECORD_AUDIO], alias = "microphone")
    ]
)
class NativeSttPlugin : Plugin() {
    private var recognizer: SpeechRecognizer? = null
    private var current: PluginCall? = null

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        call.resolve(JSObject().put("available", SpeechRecognizer.isRecognitionAvailable(context)))
    }

    @PluginMethod
    fun listen(call: PluginCall) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "micCallback")
            return
        }
        startListening(call)
    }

    @PermissionCallback
    private fun micCallback(call: PluginCall) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) startListening(call)
        else call.reject("マイクの使用が許可されませんでした", "not-allowed")
    }

    private fun finishCurrent(fn: (PluginCall) -> Unit) {
        val c = current ?: return
        current = null
        fn(c)
    }

    private fun startListening(call: PluginCall) {
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            call.reject("この端末では音声認識を使えません", "not-supported")
            return
        }
        activity.runOnUiThread {
            finishCurrent { it.reject("aborted", "aborted") }
            try {
                if (recognizer == null) {
                    recognizer = SpeechRecognizer.createSpeechRecognizer(context)
                    recognizer?.setRecognitionListener(object : RecognitionListener {
                        override fun onReadyForSpeech(params: Bundle?) {}
                        override fun onBeginningOfSpeech() {}
                        override fun onRmsChanged(rmsdB: Float) {}
                        override fun onBufferReceived(buffer: ByteArray?) {}
                        override fun onEndOfSpeech() {}
                        override fun onPartialResults(partialResults: Bundle?) {}
                        override fun onEvent(eventType: Int, params: Bundle?) {}
                        override fun onResults(results: Bundle?) {
                            val list = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            val text = list?.firstOrNull() ?: ""
                            finishCurrent {
                                if (text.isBlank()) it.reject("聞き取れませんでした", "no-speech")
                                else it.resolve(JSObject().put("text", text))
                            }
                        }
                        override fun onError(error: Int) {
                            val code = when (error) {
                                SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "no-speech"
                                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "not-allowed"
                                SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "network"
                                SpeechRecognizer.ERROR_CLIENT -> "aborted"
                                else -> "error-$error"
                            }
                            finishCurrent { it.reject("音声認識に失敗しました（$code）", code) }
                        }
                    })
                }
                current = call
                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("lang") ?: "ja-JP")
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
                recognizer?.startListening(intent)
            } catch (e: Exception) {
                finishCurrent { it.reject("音声認識を始められませんでした", "error") }
            }
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        activity.runOnUiThread {
            try { recognizer?.cancel() } catch (e: Exception) { }
            finishCurrent { it.reject("aborted", "aborted") }
        }
        call.resolve()
    }

    override fun handleOnDestroy() {
        try { recognizer?.destroy() } catch (e: Exception) { }
        recognizer = null
        super.handleOnDestroy()
    }
}
