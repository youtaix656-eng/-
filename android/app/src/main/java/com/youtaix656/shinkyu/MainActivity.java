package com.youtaix656.shinkyu;

import android.os.Bundle;
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
        super.onCreate(savedInstanceState);
    }
}
