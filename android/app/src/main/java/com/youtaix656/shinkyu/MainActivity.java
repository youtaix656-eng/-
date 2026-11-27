package com.youtaix656.shinkyu;

import android.media.AudioManager;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 自作プラグイン（音声学習×連結学習の背景再生用フォアグラウンドサービス橋渡し）は
        // super.onCreate()より前に登録する（Capacitorの既定の作法）。
        registerPlugin(BackgroundAudioPlugin.class);
        // バックアップなどのファイル書き出し（WebView では <a download> が効かないため）
        registerPlugin(BackupFilePlugin.class);
        // 読み上げ（WebView には speechSynthesis が無いため、Android 本体の TextToSpeech を使う）
        registerPlugin(NativeTtsPlugin.class);
        // 音声認識（WebView には SpeechRecognition が無いため、Android 本体の SpeechRecognizer を使う）
        registerPlugin(NativeSttPlugin.class);
        super.onCreate(savedInstanceState);

        // 音量ボタンで「メディアの音量」（読み上げの音量）を変えられるようにする
        setVolumeControlStream(AudioManager.STREAM_MUSIC);

        // 戻るボタンでアプリを閉じない（閉じると再生中の音声学習が止まる）。
        // このアプリは画面の切り替えを履歴に積まないので、戻れない時は裏に回すだけにする。
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView wv = getBridge() != null ? getBridge().getWebView() : null;
                if (wv != null && wv.canGoBack()) wv.goBack();
                else moveTaskToBack(true);
            }
        });
    }

    @Override
    public void onStart() {
        super.onStart();
        // 休憩明けの自動再開・合図音など、ボタンを押さずに鳴らす音を止めない
        try {
            getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
        } catch (Exception e) {
            // noop
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        // 音声学習の再生中（フォアグラウンドサービスが動いている間）は、裏に回っても
        // WebView の JS を止めない（止まると次の問題へ進めない）。
        if (BackgroundAudioService.getRunning()) {
            try {
                WebView wv = getBridge().getWebView();
                wv.onResume();
                wv.resumeTimers();
            } catch (Exception e) {
                // noop
            }
        }
    }
}
