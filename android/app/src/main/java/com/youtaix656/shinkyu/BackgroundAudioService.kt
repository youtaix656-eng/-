package com.youtaix656.shinkyu

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
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
    private var mediaSession: MediaSession? = null
    private var focusRequest: AudioFocusRequest? = null
    private var hasFocus = false
    // 電話などで一時的に音の出口を取られて止めた時だけ、戻った時に続きを再生する
    private var pausedByFocus = false
    private var noisyReceiver: BroadcastReceiver? = null

    // JS 側（audioEngine.js の initNativeControl）へ、通知のボタンと同じ道で操作を伝える
    private fun sendControl(action: String) {
        val intent = Intent(ACTION_CONTROL)
        intent.setPackage(packageName)
        intent.putExtra(EXTRA_ACTION, action)
        sendBroadcast(intent)
    }

    private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
        when (change) {
            // 電話・音声アシスタントなど。止めて、戻ったら続きから
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                if (playing) { pausedByFocus = true; sendControl("pause") }
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                if (pausedByFocus) { pausedByFocus = false; sendControl("play") }
            }
            AudioManager.AUDIOFOCUS_LOSS -> {
                // ほかのアプリ（音楽など）が鳴り始めた。ポモドーロの曲と一緒に聞く使い方を
                // 止めないよう、ここでは止めない（音が重なる時は自分で止める）。
                hasFocus = false
            }
        }
    }

    private fun requestFocus() {
        if (hasFocus) return
        val am = getSystemService(AUDIO_SERVICE) as AudioManager
        try {
            val r = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val req = focusRequest ?: AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build()
                    )
                    .setOnAudioFocusChangeListener(focusListener)
                    .build()
                focusRequest = req
                am.requestAudioFocus(req)
            } else {
                @Suppress("DEPRECATION")
                am.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
            }
            hasFocus = r == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        } catch (e: Exception) {
            // noop
        }
    }

    private fun abandonFocus() {
        val am = getSystemService(AUDIO_SERVICE) as AudioManager
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                focusRequest?.let { am.abandonAudioFocusRequest(it) }
            } else {
                @Suppress("DEPRECATION")
                am.abandonAudioFocus(focusListener)
            }
        } catch (e: Exception) {
            // noop
        }
        hasFocus = false
        pausedByFocus = false
    }

    // イヤホン（Bluetooth を含む）が外れたら止める（スピーカーから急に鳴り出さないように）
    private fun registerNoisy() {
        if (noisyReceiver != null) return
        val r = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                if (intent.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY && playing) sendControl("pause")
            }
        }
        noisyReceiver = r
        val filter = IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(r, filter, Context.RECEIVER_EXPORTED)
            } else {
                registerReceiver(r, filter)
            }
        } catch (e: Exception) {
            noisyReceiver = null
        }
    }

    private fun unregisterNoisy() {
        noisyReceiver?.let { try { unregisterReceiver(it) } catch (e: Exception) { } }
        noisyReceiver = null
    }

    // イヤホンのボタン（再生・一時停止・次へ・前へ）とロック画面の表示。WebView の
    // navigator.mediaSession は端末のボタンに届かないため、ここで受ける。
    private fun ensureMediaSession(): MediaSession {
        mediaSession?.let { return it }
        val s = MediaSession(this, "shinkyu-audio")
        s.setCallback(object : MediaSession.Callback() {
            override fun onPlay() { pausedByFocus = false; sendControl("play") }
            override fun onPause() { pausedByFocus = false; sendControl("pause") }
            override fun onSkipToNext() { sendControl("next") }
            override fun onSkipToPrevious() { sendControl("prev") }
            override fun onStop() { sendControl("pause") }
        })
        s.isActive = true
        mediaSession = s
        return s
    }

    private fun updateMediaSession(title: String, body: String) {
        try {
            val s = ensureMediaSession()
            val st = if (playing) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED
            s.setPlaybackState(
                PlaybackState.Builder()
                    .setActions(
                        PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or
                            PlaybackState.ACTION_PLAY_PAUSE or PlaybackState.ACTION_SKIP_TO_NEXT or
                            PlaybackState.ACTION_SKIP_TO_PREVIOUS or PlaybackState.ACTION_STOP
                    )
                    .setState(st, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1f)
                    .build()
            )
            s.setMetadata(
                MediaMetadata.Builder()
                    .putString(MediaMetadata.METADATA_KEY_TITLE, title)
                    .putString(MediaMetadata.METADATA_KEY_ARTIST, body)
                    .build()
            )
        } catch (e: Exception) {
            // noop
        }
    }

    private fun releaseMediaSession() {
        try { mediaSession?.release() } catch (e: Exception) { }
        mediaSession = null
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        val title = intent?.getStringExtra(EXTRA_TITLE) ?: "鍼灸国試対策"
        val body = intent?.getStringExtra(EXTRA_BODY) ?: ""
        if (intent?.hasExtra(EXTRA_PLAYING) == true) {
            playing = intent.getBooleanExtra(EXTRA_PLAYING, true)
        } else if (action == ACTION_START) {
            // 一時停止（playing=false）のあとに再開した時、通知が「再生」のボタンのまま残っていた
            playing = true
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
            ACTION_START -> {
                running = true
                acquireWakeLock()
                requestFocus()
                registerNoisy()
                updateMediaSession(title, body)
            }
            ACTION_STOP -> {
                running = false
                releaseWakeLock()
                abandonFocus()
                unregisterNoisy()
                releaseMediaSession()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            else -> {
                // ACTION_UPDATE：通知の差し替え（上のstartForegroundで既に反映済み）と、
                // ロック画面・イヤホンのボタン向けの再生状態
                updateMediaSession(title, body)
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        releaseWakeLock()
        abandonFocus()
        unregisterNoisy()
        releaseMediaSession()
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

    // 通知そのものを押したらアプリを開く（以前は何も起きなかった）
    private fun openAppIntent(): PendingIntent {
        val intent = Intent(this, MainActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        return PendingIntent.getActivity(this, 10, intent, flags)
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
            .setContentIntent(openAppIntent())
            .addAction(android.R.drawable.ic_media_previous, "前へ", controlPendingIntent("prev", 1))
            .addAction(playPauseIcon, playPauseLabel, controlPendingIntent("playPause", 2))
            .addAction(android.R.drawable.ic_media_next, "次へ", controlPendingIntent("next", 3))
            .build()
    }

    companion object {
        // サービスが動いているか（MainActivity が裏に回った時に WebView を止めないかの判断、
        // プラグインが「動いていない時は起こさない」判断に使う）
        @Volatile
        @JvmStatic
        var running = false
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
