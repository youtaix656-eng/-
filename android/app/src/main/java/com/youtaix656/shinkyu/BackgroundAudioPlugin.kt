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
        try {
            if (BackgroundAudioService.running) context.startService(intent)
            else ContextCompat.startForegroundService(context, intent)
            call.resolve()
        } catch (e: Exception) {
            // Android 12 以上は、裏に回っている間にフォアグラウンドサービスを新しく始められない
            // （例外で落とさず、知らせるだけにする）
            call.reject("裏に回っている間は再生の表示を始められませんでした")
        }
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
        // 動いていない時は起こさない（見出しの更新のためにサービスを始めない）
        if (BackgroundAudioService.running) {
            try { context.startService(intent) } catch (e: Exception) { }
        }
        call.resolve()
    }

    // 束を聞き終えた等を、ふつうの通知で1回知らせる（WebView には Notification API が無いため）
    @PluginMethod
    fun notifyDone(call: PluginCall) {
        val title = call.getString("title") ?: "音声学習"
        val body = call.getString("body") ?: ""
        try {
            val nm = context.getSystemService(android.app.NotificationManager::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                nm.getNotificationChannel(DONE_CHANNEL) == null) {
                nm.createNotificationChannel(android.app.NotificationChannel(
                    DONE_CHANNEL, "音声学習のお知らせ", android.app.NotificationManager.IMPORTANCE_DEFAULT))
            }
            val open = Intent(context, MainActivity::class.java)
            open.flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            val pflags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
                android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
            else android.app.PendingIntent.FLAG_UPDATE_CURRENT
            val n = androidx.core.app.NotificationCompat.Builder(context, DONE_CHANNEL)
                .setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(R.drawable.ic_stat_play)
                .setAutoCancel(true)
                .setContentIntent(android.app.PendingIntent.getActivity(context, 11, open, pflags))
                .build()
            nm.notify(4202, n)
            call.resolve()
        } catch (e: Exception) {
            call.reject("通知を出せませんでした")
        }
    }

    // 再生中は画面を消さない（WebView の navigator.wakeLock の代わり。止めたら必ず外す）
    @PluginMethod
    fun keepAwake(call: PluginCall) {
        val on = call.getBoolean("on") ?: false
        val act = activity
        if (act == null) { call.resolve(); return }
        act.runOnUiThread {
            try {
                if (on) act.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                else act.window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            } catch (e: Exception) {
                // noop
            }
        }
        call.resolve()
    }

    // 電池の最適化の対象外になっているか（対象のままだと、画面を消している間に止められやすい）
    @PluginMethod
    fun batteryStatus(call: PluginCall) {
        var ignoring = true
        try {
            val pm = context.getSystemService(android.content.Context.POWER_SERVICE) as android.os.PowerManager
            ignoring = pm.isIgnoringBatteryOptimizations(context.packageName)
        } catch (e: Exception) {
            // 分からない時は「対象外」として案内を出さない
        }
        call.resolve(JSObject().put("ignoring", ignoring))
    }

    // 電池の最適化の設定画面を開く（どのアプリを外すかは本人が選ぶ。勝手には外さない）
    @PluginMethod
    fun openBatterySettings(call: PluginCall) {
        try {
            val i = Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(i)
            call.resolve()
        } catch (e: Exception) {
            call.reject("設定を開けませんでした")
        }
    }

    companion object {
        const val DONE_CHANNEL = "shinkyu_audio_done"
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        val intent = Intent(context, BackgroundAudioService::class.java)
        intent.action = BackgroundAudioService.ACTION_STOP
        // 動いていないサービスを止めるために起こさない（裏で起こすと Android 12 以上は例外になる）
        if (BackgroundAudioService.running) {
            try {
                context.startService(intent)
            } catch (e: Exception) {
                try { context.stopService(Intent(context, BackgroundAudioService::class.java)) } catch (e2: Exception) { }
            }
        }
        call.resolve()
    }
}
