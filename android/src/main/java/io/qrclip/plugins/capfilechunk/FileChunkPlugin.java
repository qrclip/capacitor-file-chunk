package io.qrclip.plugins.capfilechunk;

import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.io.RandomAccessFile;
import java.util.Base64;
import java.util.Random;

@CapacitorPlugin(name = "FileChunk")
public class FileChunkPlugin extends Plugin {
    private FileChunkServer mServer = null;

    ////////////////////////////////////////////////////////////////
    // START SERVER
    @PluginMethod
    public void startServer(PluginCall call) {
        // GET CONFIGURATION PARAMETERS
        String tEncryptionKeyBase64 = call.getString("key");
        boolean tUseEncryption = Boolean.TRUE.equals(call.getBoolean("encryption"));
        Integer tPort = call.getInt("port", 0);
        Integer tPortMin = call.getInt("portMin", 49151);
        Integer tPortMax = call.getInt("portMax", 65536);
        Integer tRetries = call.getInt("retries", 5);
        Integer tChunkSize = call.getInt("chunkSize", 10024000);
        Integer tChunkSizeFinal = tChunkSize;
        if (tUseEncryption) {
            tChunkSizeFinal += 12 + 16; // IV AND AUTH TAG
        }

        // INIT THE SERVER
        this.initTheServerInstance(tPort, tPortMin, tPortMax, tRetries, tChunkSizeFinal);

        JSObject tResponse = new JSObject();
        tResponse.put("version", 2);
        tResponse.put("platform", "android");

        // IF SERVER CREATED
        if (this.mServer != null && this.mServer.getListeningPort() > 0) {
            boolean tEncryptionOK = this.mServer.setEncryption(tUseEncryption, tEncryptionKeyBase64);
            tResponse.put("baseUrl", "http://localhost:" + this.mServer.getListeningPort());
            tResponse.put("authToken", this.mServer.getAuthToken());
            tResponse.put("chunkSize", tChunkSize);
            if (tUseEncryption && tEncryptionOK) {
                tResponse.put("encryptionType", "ChaCha20-Poly1305");
            } else {
                tResponse.put("encryptionType", "none");
            }
            tResponse.put("ready", tEncryptionOK);
        } else {
            // IF SERVER FAILED TO CREATE
            tResponse.put("baseUrl", "");
            tResponse.put("authToken", "");
            tResponse.put("chunkSize", 0);
            tResponse.put("encryptionType", "none");
            tResponse.put("ready", false);
        }
        call.resolve(tResponse);
    }

    ////////////////////////////////////////////////////////////////
    // START SERVER
    @PluginMethod
    public void stopServer(PluginCall call) {
        if (this.mServer != null) {
            this.mServer.stop();
            this.mServer = null;
        }
        call.resolve();
    }

    ////////////////////////////////////////////////////////////////
    // START SERVER
    @PluginMethod
    public void readFileChunk(PluginCall call) {
        String tPath = call.getString("path");
        Integer tOffset = call.getInt("offset", 0);
        Integer tLength = call.getInt("length", 0);
        JSObject tResponse = new JSObject();

        byte[] tBuffer = new byte[tLength];
        try (RandomAccessFile tRandomAccessFile = new RandomAccessFile(tPath, "r")) {
            tRandomAccessFile.seek(tOffset); // MOVE TO OFFSET
            tRandomAccessFile.read(tBuffer, 0, tLength);
            tResponse.put("data",android.util.Base64.encodeToString(tBuffer, android.util.Base64.NO_WRAP));
            call.resolve(tResponse);
        } catch (IOException e) {
            tResponse.put("data", "");
            call.resolve(tResponse);
        }

    }

    ////////////////////////////////////////////////////////////////
    // INIT THE SERVER INSTANCE
    private void initTheServerInstance(Integer tFixedPort, Integer tPortMin, Integer tPortMax, Integer tRetries, Integer tChunkSize) {
        // RETRIES LEFT
        int tRetriesLeft = tRetries;

        // IF FIXED PORT SET USE THAT
        if (tFixedPort > 0) {
            this.StartServerAtPort(tFixedPort, tChunkSize);
            if (tRetries <= 0) { // IF NO RETRIES ARE SET NO MORE ARE TRIED
                return;
            }
        }

        // RANGE OF PORTS TO TRY
        int tStartPort = tPortMin;
        int tEndPort = tPortMax;
        Random tRandom = new Random();
        while (this.mServer == null && tRetriesLeft > 0) {
            int tPort = tStartPort + tRandom.nextInt(tEndPort - tStartPort);
            this.StartServerAtPort(tPort, tChunkSize);
            tRetriesLeft--;
        }
    }

    ////////////////////////////////////////////////////////////////
    // START SERVER AT PORT
    private void StartServerAtPort(Integer tPort, Integer tMaxSize) {
        FileChunkServer tServer = new FileChunkServer(tPort, tMaxSize);
        try {
            tServer.start();
            this.mServer = tServer;
        } catch (IOException ex) {
            Log.e(getLogTag(), "Failed to start server on port " + tPort, ex);
        }
    }
}
