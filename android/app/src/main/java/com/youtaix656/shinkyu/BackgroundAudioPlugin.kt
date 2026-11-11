package com.youtaix656.shinkyu

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * JS側（src/lib/nativeBridge.js、window.Capacitor.Plugins.BackgroundAudio経由）から呼ばれる
 * ネイティブ橋渡し。曲や問題の内容は一切持たず、通知に出す見出し（title/body）・
 * 再生中かどうか（playing）だけを受け取ってBackgroundAudioServiceへ中継する。
 * 通知のボタン操作（前へ/再生・一時停止/次へ）はBroadcastで受け取り、
 * `controlAction`イベントとしてJSへ返す（実際の制御はJS側のaudioEngine.jsが行う）。
 *
 * 【未検証】CLAUDE.md参照。このセッションにAndroid SDKが無いためビルド・実機確認は
 * 行えていない。
 */
@CapacitorPlugin(
    name = "BackgroundAudio",
    permissions = [
        Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = "notifications")
    ]
)
class BackgroundAudioPlugin : Plugin() {

    private var controlReceiver: BroadcastReceiver? = null

    override fun load() {
        super.load()
        val filter = IntentFilter(BackgroundAudioService.ACTION_CONTROL)
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                val action = intent.getStringExtra(BackgroundAudioService.EXTRA_ACTION) ?: return
                val data = JSObject()
                data.put("action", action)
                notifyListeners("controlAction", data)
            }
        }
        controlReceiver = receiver
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            context.registerReceiver(receiver, filter)
        }
    }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        controlReceiver?.let {
            try {
                context.unregisterReceiver(it)
            } catch (e: Exception) {
                // noop（未登録のまま呼ばれても落とさない）
            }
        }
        controlReceiver = null
    }

    @PluginMethod
    fun start(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissionForAlias("notifications", call, "notificationPermCallback")
            return
        }
        startServiceWithCall(call)
    }

    @PermissionCallback
    private fun notificationPermCallback(call: PluginCall) {
        // 通知の許可が無くても、フォアグラウンドサービス自体は開始する
        // （通知が出ないだけで再生の続行自体は妨げない＝行き止まりにしない）。
        startServiceWithCall(call)
    }

    private fun startServiceWithCall(call: PluginCall) {
        val title = call.getString("title") ?: "鍼灸国試対策"
        val body = call.getString("body") ?: "音声学習を再生中"
        val intent = Intent(context, BackgroundAudioService::class.java)
        intent.action = BackgroundAudioService.ACTION_START
        intent.putExtra(BackgroundAudioService.EXTRA_TITLE, title)
        intent.putExtra(BackgroundAudioService.EXTRA_BODY, body)
        ContextCompat.startForegroundService(context, intent)
        call.resolve()
    }

    @PluginMethod
    fun update(call: PluginCall) {
        val title = call.getString("title") ?: "鍼灸国試対策"
        val body = call.getString("body") ?: ""
        val playing = call.getBoolean("playing") ?: true
        val intent = Intent(context, BackgroundAudioService::class.java)
        intent.action = BackgroundAudioService.ACTION_UPDATE
        intent.putExtra(BackgroundAudioService.EXTRA_TITLE, title)
        intent.putExtra(BackgroundAudioService.EXTRA_BODY, body)
        intent.putExtra(BackgroundAudioService.EXTRA_PLAYING, playing)
        ContextCompat.startForegroundService(context, intent)
        call.resolve()
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        val intent = Intent(context, BackgroundAudioService::class.java)
        intent.action = BackgroundAudioService.ACTION_STOP
        ContextCompat.startForegroundService(context, intent)
        call.resolve()
    }
}
