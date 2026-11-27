package com.youtaix656.shinkyu

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

/**
 * アプリ版（Android の WebView）には speechSynthesis（Web Speech API）が無く、
 * 音声学習の画面が「お使いのブラウザは音声合成に対応していません」で止まっていた。
 * Android 本体の読み上げ（TextToSpeech）で代わりに読む。
 * JS 側は src/lib/speech.js（nativeTts() があればこちらを使う）。
 *
 * - speak：1つの文を読み、読み終わったら resolve（止められたら {canceled:true}）。
 *   後ろに並べる（QUEUE_ADD）＝ブラウザの speechSynthesis.speak と同じ振る舞い。
 * - stop：読み上げを止め、並んでいる分も含めて {canceled:true} で返す。
 * - isAvailable：日本語で読めるか（読み上げエンジン・日本語の音声データがあるか）。
 */
@CapacitorPlugin(name = "NativeTts")
class NativeTtsPlugin : Plugin() {
    private var tts: TextToSpeech? = null
    private var ready = false
    private var initError: String? = null
    private val waitingInit = mutableListOf<() -> Unit>()
    private val pending = ConcurrentHashMap<String, PluginCall>()
    private var seq = 0L

    override fun load() {
        tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                val r = tts?.setLanguage(Locale.JAPAN) ?: TextToSpeech.LANG_NOT_SUPPORTED
                if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
                    initError = "日本語の読み上げデータがありません。端末の設定（ユーザー補助 → テキスト読み上げ）で日本語の音声データを入れてください。"
                } else {
                    ready = true
                    // 「メディアの音量」で鳴らす（着信音・通知の音量にならないように）
                    try {
                        tts?.setAudioAttributes(
                            AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_MEDIA)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                .build()
                        )
                    } catch (e: Exception) {
                        // noop
                    }
                }
            } else {
                initError = "端末の読み上げエンジンを使えませんでした。端末の設定（ユーザー補助 → テキスト読み上げ）を確認してください。"
            }
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {}
                override fun onDone(utteranceId: String?) {
                    utteranceId?.let { pending.remove(it)?.resolve(JSObject().put("canceled", false)) }
                }
                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {
                    utteranceId?.let { pending.remove(it)?.reject("読み上げに失敗しました") }
                }
                override fun onError(utteranceId: String?, errorCode: Int) {
                    utteranceId?.let { pending.remove(it)?.reject("読み上げに失敗しました（$errorCode）") }
                }
                override fun onStop(utteranceId: String?, interrupted: Boolean) {
                    utteranceId?.let { pending.remove(it)?.resolve(JSObject().put("canceled", true)) }
                }
            })
            val list = synchronized(waitingInit) { waitingInit.toList().also { waitingInit.clear() } }
            list.forEach { it() }
        }
    }

    private fun whenInit(fn: () -> Unit) {
        val run = synchronized(waitingInit) {
            if (ready || initError != null) true else { waitingInit.add(fn); false }
        }
        if (run) fn()
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        whenInit {
            val ret = JSObject()
            ret.put("available", ready)
            ret.put("error", initError)
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun speak(call: PluginCall) {
        val text = call.getString("text") ?: ""
        if (text.isBlank()) {
            call.resolve(JSObject().put("canceled", false))
            return
        }
        whenInit {
            val engine = tts
            if (!ready || engine == null) {
                call.reject(initError ?: "読み上げを使えません")
                return@whenInit
            }
            val rate = (call.getFloat("rate") ?: 1f).coerceIn(0.1f, 4f)
            val pitch = (call.getFloat("pitch") ?: 1f).coerceIn(0.1f, 4f)
            val volume = (call.getFloat("volume") ?: 1f).coerceIn(0f, 1f)
            engine.setSpeechRate(rate)
            engine.setPitch(pitch)
            val id = "u" + (++seq)
            pending[id] = call
            val params = Bundle()
            params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, volume)
            val r = engine.speak(text, TextToSpeech.QUEUE_ADD, params, id)
            if (r != TextToSpeech.SUCCESS) {
                pending.remove(id)
                call.reject("読み上げを始められませんでした")
            }
        }
    }

    // 無音の間（問題と答えの間など）も読み上げの列の中で取る。WebView の setTimeout は
    // 画面を消している間に間引かれるが、ここは端末の読み上げが数えるので遅れない。
    @PluginMethod
    fun silence(call: PluginCall) {
        val ms = (call.getInt("ms") ?: 0).coerceIn(0, 120000)
        if (ms <= 0) {
            call.resolve(JSObject().put("canceled", false))
            return
        }
        whenInit {
            val engine = tts
            if (!ready || engine == null) {
                call.reject(initError ?: "読み上げを使えません")
                return@whenInit
            }
            val id = "s" + (++seq)
            pending[id] = call
            val r = engine.playSilentUtterance(ms.toLong(), TextToSpeech.QUEUE_ADD, id)
            if (r != TextToSpeech.SUCCESS) {
                pending.remove(id)
                call.reject("無音を入れられませんでした")
            }
        }
    }

    // イヤホン（有線・Bluetooth・USB）がつながっているか。WebView では機器の名前が取れないため。
    @PluginMethod
    fun headphones(call: PluginCall) {
        var found = false
        try {
            val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val types = setOf(
                AudioDeviceInfo.TYPE_WIRED_HEADSET,
                AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
                AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
                AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
                AudioDeviceInfo.TYPE_USB_HEADSET,
                26 // TYPE_BLE_HEADSET（Android 12 以上）
            )
            found = am.getDevices(AudioManager.GET_DEVICES_OUTPUTS).any { it.type in types }
        } catch (e: Exception) {
            // noop
        }
        call.resolve(JSObject().put("connected", found))
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        tts?.stop()
        // onStop が来ない端末もあるので、残っている分はここで返す
        val ids = pending.keys.toList()
        ids.forEach { pending.remove(it)?.resolve(JSObject().put("canceled", true)) }
        call.resolve()
    }

    override fun handleOnDestroy() {
        try {
            tts?.stop()
            tts?.shutdown()
        } catch (e: Exception) {
            // noop
        }
        tts = null
        super.handleOnDestroy()
    }
}
