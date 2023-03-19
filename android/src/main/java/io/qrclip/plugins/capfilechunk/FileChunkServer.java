package io.qrclip.plugins.capfilechunk;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import fi.iki.elonen.NanoHTTPD;


public class FileChunkServer extends NanoHTTPD {
    private final String mAuthToken = UUID.randomUUID().toString();
    private final int mReadingChunkSize = 512 * 1024;

    ///////////////////////////////////////////////////////////////
    // CONSTRUCTOR
    public FileChunkServer(int tPort){
        super(tPort);
    }

    ///////////////////////////////////////////////////////////////
    // GET AUTH TOKEN
    public String getAuthToken() {
        return mAuthToken;
    }

    ///////////////////////////////////////////////////////////////
    // NEW FILE CHUNK RESPONSE
    public Response newCorsResponse(Response.IStatus tStatus, IHTTPSession tSession) {
        String tOrigin = tSession.getHeaders().get("origin");
        Response tResponse = newFixedLengthResponse(tStatus, "text/plain", null, 0);

        // disables Gzip and thereby fixes weird timing-based broken pipe exceptions
        tResponse.addHeader("Content-Length", "0");

        if (tOrigin != null) {
            tResponse.addHeader("Access-Control-Allow-Origin", tOrigin);
            tResponse.addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, HEAD, OPTIONS");

            String tRequestHeaders = tSession.getHeaders().get("access-control-request-headers");
            if (tRequestHeaders != null) {
                tResponse.addHeader("Access-Control-Allow-Headers", tRequestHeaders);
            }
        }

        return tResponse;
    }

    ///////////////////////////////////////////////////////////////
    // SERVE - ENTRY POINT
    @Override
    public Response serve(IHTTPSession tSession) {
        if (tSession.getMethod() == Method.OPTIONS) {
            return newCorsResponse(Response.Status.OK, tSession);
        }

        String tAuth = tSession.getHeaders().get("authorization");
        if (tAuth == null || !tAuth.equals(this.mAuthToken)) {
            return newCorsResponse(Response.Status.UNAUTHORIZED, tSession);
        }

        if (tSession.getMethod() == Method.PUT) {
            return this.handlePUT(tSession);
        }
        if (tSession.getMethod() == Method.GET) {
            return this.handleGET(tSession);
        }

        return newCorsResponse(Response.Status.METHOD_NOT_ALLOWED, tSession);
    }

    ///////////////////////////////////////////////////////////////
    // HANDLE PUT
    public Response handlePUT(IHTTPSession tSession) {
        long tContentLength;
        try {
            tContentLength = Long.parseLong(
                    Objects.requireNonNull(tSession.getHeaders().get("content-length"))
            );
        } catch (NumberFormatException ex) {
            return newCorsResponse(Response.Status.BAD_REQUEST, tSession);
        }

        try {
            String tDestPath = tSession.getUri();
            File tDestFile = new File(tDestPath);
            byte[] buf = new byte[this.mReadingChunkSize];
            int bytesRead;
            long totalBytesRead = 0;
            InputStream in = tSession.getInputStream();
            try (OutputStream out = new FileOutputStream(tDestFile, true)) {
                // reading from a finished input stream causes a socket timeout error
                while (totalBytesRead < tContentLength && (bytesRead = in.read(buf)) > 0) {
                    out.write(buf, 0, bytesRead);
                    totalBytesRead += bytesRead;
                }
            }
            // 204 response
            return newCorsResponse(Response.Status.NO_CONTENT, tSession);
        } catch (Exception ex) {
            return newCorsResponse(Response.Status.BAD_REQUEST, tSession);
        }
    }

    ///////////////////////////////////////////////////////////////
    // HANDLE GET
    public Response handleGET(IHTTPSession tSession) {
        String tDestPath = tSession.getUri();

        int tOffset;
        int tSize;

        List<String> tOffsetParam = tSession.getParameters().get("o");
        List<String> tSizeParam = tSession.getParameters().get("l");
        if(tOffsetParam != null && tOffsetParam.size() == 1 && tSizeParam != null &&  tSizeParam.size() == 1){
            tOffset = Integer.parseInt(tOffsetParam.get(0));
            tSize = Integer.parseInt(tSizeParam.get(0));
        } else {
            return newCorsResponse(Response.Status.BAD_REQUEST, tSession);
        }

        try {
            byte[] tBuffer = new byte[tSize];
            try (RandomAccessFile tRandomAccessFile = new RandomAccessFile(tDestPath, "r")) {
                tRandomAccessFile.seek(tOffset);
                tRandomAccessFile.read(tBuffer, 0, tSize);
            } catch (IOException e) {
                return newCorsResponse(Response.Status.BAD_REQUEST, tSession);
            }

            Response tResponse = newFixedLengthResponse(Response.Status.OK, "application/octet-stream",  new ByteArrayInputStream(tBuffer), tSize);
            String tOrigin = tSession.getHeaders().get("origin");
            if (tOrigin != null) {
                tResponse.addHeader("Access-Control-Allow-Origin", tOrigin);
                tResponse.addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, HEAD, OPTIONS");
                String tRequestHeaders = tSession.getHeaders().get("access-control-request-headers");
                if (tRequestHeaders != null) {
                    tResponse.addHeader("Access-Control-Allow-Headers", tRequestHeaders);
                }
            }
            return tResponse;
        } catch (Exception ex) {
            return newCorsResponse(Response.Status.BAD_REQUEST, tSession);
        }
    }
}
