package com.youtaix656.shinkyu

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

/**
 * 音声学習×連結学習の再生中、画面ロック・バックグラウンドへ移っても再生（読み上げの
 * シーケンス進行）が止まりにくくなるよう、フォアグラウンドサービスとしてプロセスの
 * 優先度を上げ続ける役目だけを持つ。実際の読み上げ自体はWebView側のJS
 * （speechSynthesis／ボイスクローンのaudio要素、src/lib/audioEngine.js）がそのまま行う
 * ——ここは「OSにプロセスを凍結・停止されない状態」を保つための土台で、読み上げそのものを
 * ネイティブへ移してはいない（CLAUDE.mdの該当セクション参照。もし画面OFF時にJSの
 * シーケンス進行自体が止まることが実機検証で分かった場合、次の一手は読み上げの
 * シーケンサーごとネイティブへ移すことになるが、今回のバッチでは着手していない）。
 *
 * JS側（src/lib/nativeBridge.js経由）が再生開始/更新/終了のタイミングでstart/update/stopを
 * 呼ぶ（BackgroundAudioPlugin.kt）。通知のボタン（前へ/再生・一時停止/次へ）を押した時は
 * ACTION_CONTROLのBroadcastでBackgroundAudioPluginへ伝え、そこからJSへ`controlAction`
 * イベントとして返す（実際の制御はJS側のaudioEngine.jsが行う。ここでは曲や問題の内容は
 * 一切持たない＝「次に何を読むか」はJSが決める）。
 *
 * 【未検証】このファイル・このプロジェクト全体は、このセッションの実行環境にAndroid SDKが
 * 無く（dl.google.comへの接続がプロキシの方針で遮断されているためインストールできない）、
 * Gradleビルド・実機確認のいずれも行えていない。実際のビルド・動作確認は、ユーザー自身の
 * Android Studio環境で行う必要がある。
 */
class BackgroundAudioService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null
    private var playing = true

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        val title = intent?.getStringExtra(EXTRA_TITLE) ?: "鍼灸国試対策"
        val body = intent?.getStringExtra(EXTRA_BODY) ?: ""
        if (intent?.hasExtra(EXTRA_PLAYING) == true) {
            playing = intent.getBooleanExtra(EXTRA_PLAYING, true)
        }

        // どのactionでも、まず（再）起動直後にstartForegroundを呼ぶ
        // （Android 12+の「一定時間内に呼ばないと例外」を避けるため。STOPの時も
        // 一旦フォアグラウンド状態にしてから直後にstopForegroundする、という手順でよい）。
        ensureChannel()
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        } else {
            0
        }
        ServiceCompat.startForeground(this, NOTIF_ID, buildNotification(title, body), type)

        when (action) {
            ACTION_START -> acquireWakeLock()
            ACTION_STOP -> {
                releaseWakeLock()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            else -> {
                // ACTION_UPDATE：通知の差し替えのみ（上のstartForegroundで既に反映済み）
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        releaseWakeLock()
        super.onDestroy()
    }

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "shinkyu:BackgroundAudioWakeLock")
        wakeLock?.setReferenceCounted(false)
        // 切り忘れ対策の上限（6時間）。JS側のstopで通常はもっと早く解放される。
        wakeLock?.acquire(6 * 60 * 60 * 1000L)
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
        } catch (e: Exception) {
            // noop
        }
        wakeLock = null
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL_ID) == null) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "音声学習の再生",
                NotificationManager.IMPORTANCE_LOW
            )
            channel.setSound(null, null)
            nm.createNotificationChannel(channel)
        }
    }

    private fun controlPendingIntent(action: String, code: Int): PendingIntent {
        val intent = Intent(ACTION_CONTROL)
        intent.setPackage(packageName)
        intent.putExtra(EXTRA_ACTION, action)
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        return PendingIntent.getBroadcast(this, code, intent, flags)
    }

    private fun buildNotification(title: String, body: String): Notification {
        val playPauseIcon = if (playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
        val playPauseLabel = if (playing) "一時停止" else "再生"
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(R.drawable.ic_stat_play)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .addAction(android.R.drawable.ic_media_previous, "前へ", controlPendingIntent("prev", 1))
            .addAction(playPauseIcon, playPauseLabel, controlPendingIntent("playPause", 2))
            .addAction(android.R.drawable.ic_media_next, "次へ", controlPendingIntent("next", 3))
            .build()
    }

    companion object {
        const val CHANNEL_ID = "shinkyu_background_audio"
        const val NOTIF_ID = 4201
        const val ACTION_START = "com.youtaix656.shinkyu.action.START"
        const val ACTION_UPDATE = "com.youtaix656.shinkyu.action.UPDATE"
        const val ACTION_STOP = "com.youtaix656.shinkyu.action.STOP"
        const val ACTION_CONTROL = "com.youtaix656.shinkyu.action.CONTROL"
        const val EXTRA_TITLE = "title"
        const val EXTRA_BODY = "body"
        const val EXTRA_PLAYING = "playing"
        const val EXTRA_ACTION = "action"
    }
}
