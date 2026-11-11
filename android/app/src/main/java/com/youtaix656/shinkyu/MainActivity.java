package com.youtaix656.shinkyu;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 自作プラグイン（音声学習×連結学習の背景再生用フォアグラウンドサービス橋渡し）は
        // super.onCreate()より前に登録する（Capacitorの既定の作法）。
        registerPlugin(BackgroundAudioPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
