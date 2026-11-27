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

    // 日本語の読み上げデータが無かった（あとから入れられる）か、エンジンそのものが使えなかったか
    private var langMissing = false
    private var restarting = false

    override fun load() {
        initEngine()
    }

    private fun audioAttrs(): AudioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build()

    // 日本語にできるかを試す。できれば ready。設定で日本語の音声データを入れて戻った時にも使う
    // （以前は起動した時の結果を持ち続け、データを入れてもアプリを開き直すまで読めなかった）。
    private fun applyLanguage(): Boolean {
        val r = tts?.setLanguage(Locale.JAPAN) ?: TextToSpeech.LANG_NOT_SUPPORTED
        if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
            ready = false
            langMissing = true
            initError = "日本語の読み上げデータがありません。端末の設定（ユーザー補助 → テキスト読み上げ）で日本語の音声データを入れてください。"
            return false
        }
        ready = true
        langMissing = false
        initError = null
        // 「メディアの音量」で鳴らす（着信音・通知の音量にならないように）
        try { tts?.setAudioAttributes(audioAttrs()) } catch (e: Exception) { }
        return true
    }

    private fun initEngine() {
        ready = false
        initError = null
        langMissing = false
        tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                applyLanguage()
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
                    // 読み上げエンジンが落ちた（ほかのアプリの更新・メモリ不足で切られた等）。作り直す
                    if (errorCode == TextToSpeech.ERROR_SERVICE) restartEngine()
                }
                override fun onStop(utteranceId: String?, interrupted: Boolean) {
                    utteranceId?.let { pending.remove(it)?.resolve(JSObject().put("canceled", true)) }
                }
            })
            restarting = false
            val list = synchronized(waitingInit) { waitingInit.toList().also { waitingInit.clear() } }
            list.forEach { it() }
        }
    }

    // エンジンが落ちた時は作り直し、待っている呼び出しはその後に続ける（1問ずつ飛ばし続けない）
    private fun restartEngine() {
        synchronized(waitingInit) {
            if (restarting) return
            restarting = true
        }
        activity.runOnUiThread {
            try { tts?.shutdown() } catch (e: Exception) { }
            tts = null
            initEngine()
        }
    }

    private fun whenInit(fn: () -> Unit) {
        val run = synchronized(waitingInit) {
            if (!restarting && (ready || initError != null)) true else { waitingInit.add(fn); false }
        }
        if (run) {
            // 日本語のデータが無かった時は、呼ばれるたびに入ったかを確かめ直す
            if (!ready && langMissing && tts != null) applyLanguage()
            fn()
        }
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        // 読み上げエンジンそのものが使えなかった時は、設定から戻った時などに作り直して確かめ直す
        if (!ready && !langMissing && initError != null && !restarting) restartEngine()
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
                call.reject(initError ?: "読み上げを使えません", "unavailable")
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
                if (call.getBoolean("_retried") != true) {
                    // エンジンが切られていた時は作り直してから1回だけ読み直す
                    call.data.put("_retried", true)
                    restartEngine()
                    speak(call)
                } else {
                    call.reject("読み上げを始められませんでした")
                }
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

    // 端末の読み上げの設定（日本語の音声データを入れる・声を選ぶ）を開く
    @PluginMethod
    fun openSettings(call: PluginCall) {
        try {
            val i = android.content.Intent("com.android.settings.TTS_SETTINGS")
            i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(i)
            call.resolve()
        } catch (e: Exception) {
            try {
                val i = android.content.Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS)
                i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(i)
                call.resolve()
            } catch (e2: Exception) {
                call.reject("設定を開けませんでした")
            }
        }
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
