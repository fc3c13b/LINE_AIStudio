package com.lineaistudio.dev;

import android.os.Bundle;
import android.webkit.WebSettings;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
        getBridge().getWebView().getSettings().setMixedContentMode(
            WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        );
    }
}
