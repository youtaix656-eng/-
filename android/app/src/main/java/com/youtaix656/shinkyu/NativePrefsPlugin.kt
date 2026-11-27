package com.youtaix656.shinkyu

import android.content.Context
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * 音声学習の「続きから」と再生履歴を、端末の SharedPreferences にも残す（src/lib/nativeMirror.js）。
 * WebView の localStorage は書き出しが遅れるので、アプリが急に終わると直前の位置が残らないことがある。
 * ここは commit()（その場でファイルへ書く）。保存するのは JS から渡された文字列だけで、外へは送らない。
 */
@CapacitorPlugin(name = "NativePrefs")
class NativePrefsPlugin : Plugin() {
    private fun sp() = context.getSharedPreferences("shinkyu_mirror", Context.MODE_PRIVATE)

    @PluginMethod
    fun set(call: PluginCall) {
        val key = call.getString("key")
        if (key.isNullOrBlank()) { call.reject("key がありません"); return }
        val value = call.getString("value") ?: ""
        try {
            sp().edit().putString(key, value).commit()
            call.resolve()
        } catch (e: Exception) {
            call.reject("保存できませんでした")
        }
    }

    @PluginMethod
    fun get(call: PluginCall) {
        val key = call.getString("key")
        if (key.isNullOrBlank()) { call.reject("key がありません"); return }
        val ret = JSObject()
        val v = try { sp().getString(key, null) } catch (e: Exception) { null }
        if (v != null) ret.put("value", v)
        call.resolve(ret)
    }

    @PluginMethod
    fun remove(call: PluginCall) {
        val key = call.getString("key")
        if (key.isNullOrBlank()) { call.resolve(); return }
        try { sp().edit().remove(key).commit() } catch (e: Exception) { }
        call.resolve()
    }
}
