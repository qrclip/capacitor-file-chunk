package io.qrclip.plugins.capfilechunk;

import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.util.Random;

@CapacitorPlugin(name = "FileChunk")
public class FileChunkPlugin extends Plugin {
    private FileChunkServer mServer = null;

    ////////////////////////////////////////////////////////////////
    // LOAD
    @Override
    public void load() {
        super.load();

        // listen on an open port
        int tRetriesLeft = 5;

        // range of private ports
        int tStartPort = 49151;
        int tEndPort = 65536;
        Random tRandom = new Random();

        while (this.mServer == null && tRetriesLeft > 0) {
            int tPort = tStartPort + tRandom.nextInt(tEndPort - tStartPort);
            this.mServer = new FileChunkServer(tPort);
            FileChunkServer tServer = new FileChunkServer(tPort);
            try {
                tServer.start();
                this.mServer = tServer;
            } catch (IOException ex) {
                Log.e(getLogTag(), "Failed to start server on port " + tPort, ex);
            }
            tRetriesLeft--;
        }
    }

    ////////////////////////////////////////////////////////////////
    // CONNECT INFO
    @PluginMethod
    public void connectInfo(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("version", 1);
        ret.put("platform", "android");
        if (this.mServer != null) {
            ret.put("baseUrl", "http://localhost:" + this.mServer.getListeningPort());
            ret.put("AuthToken", this.mServer.getAuthToken());
            ret.put("chunkSize", 10024000);
            call.resolve(ret);
        } else {
            ret.put("baseUrl", "");
            ret.put("AuthToken", "");
            ret.put("chunkSize", 0);
            call.resolve(ret);
        }
    }
}
