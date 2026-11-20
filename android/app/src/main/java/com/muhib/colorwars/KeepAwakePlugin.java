package com.muhib.colorwars;

import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Keeps the screen on only while a match is open. */
@CapacitorPlugin(name = "KeepAwake")
public class KeepAwakePlugin extends Plugin {

    private boolean held = false;

    @PluginMethod
    public void keepAwake(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            getActivity().getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            held = true;
            call.resolve();
        });
    }

    @PluginMethod
    public void allowSleep(PluginCall call) {
        release();
        call.resolve();
    }

    private void release() {
        if (!held || getActivity() == null) return;
        getActivity().getWindow().clearFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        held = false;
    }

    @Override
    protected void handleOnDestroy() {
        release();
        super.handleOnDestroy();
    }
}
