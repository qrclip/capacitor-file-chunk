package io.qrclip.plugins.capfilechunk;

import java.io.ByteArrayInputStream;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import fi.iki.elonen.NanoHTTPD;


public class FileChunkServer extends NanoHTTPD {
    private final String mAuthToken = UUID.randomUUID().toString();
    private final FileChunkProcessor mFileChunkProcessor = new FileChunkProcessor();
    private final int mMaxSize;

    ///////////////////////////////////////////////////////////////
    // CONSTRUCTOR
    public FileChunkServer(int tPort, int tMaxSize){
        super(tPort);
        this.mMaxSize = tMaxSize;
    }

    ///////////////////////////////////////////////////////////////
    // SET ENCRYPTION
    public boolean setEncryption(boolean tUseEncryption, String tKeyBase64) {
        return this.mFileChunkProcessor.setEncryption(tUseEncryption, tKeyBase64);
    }

    ///////////////////////////////////////////////////////////////
    // GET AUTH TOKEN
    public String getAuthToken() {
        return mAuthToken;
    }

    ///////////////////////////////////////////////////////////////
    // SERVE - ENTRY POINT
    @Override
    public Response serve(IHTTPSession tSession) {
        // OPTIONS METHOD
        if (tSession.getMethod() == Method.OPTIONS) {
            return newCORSResponse(Response.Status.OK, tSession);
        }

        // CHECK TOKEN
        String tAuth = tSession.getHeaders().get("authorization");
        if (tAuth == null || !tAuth.equals(this.mAuthToken)) {
            return newCORSResponse(Response.Status.UNAUTHORIZED, tSession);
        }

        // PUT METHOD
        if (tSession.getMethod() == Method.PUT) {
            return this.handlePUT(tSession);
        }

        // GET METHOD
        if (tSession.getMethod() == Method.GET) {
            return this.handleGET(tSession);
        }

        return newCORSResponse(Response.Status.METHOD_NOT_ALLOWED, tSession);
    }

    ///////////////////////////////////////////////////////////////
    // HANDLE PUT
    public Response handlePUT(IHTTPSession tSession) {
        // CHECK CONTENT LENGTH
        long tContentLength;
        try {
            tContentLength = Long.parseLong(
                    Objects.requireNonNull(tSession.getHeaders().get("content-length"))
            );
        } catch (NumberFormatException ex) {
            return newCORSResponse(Response.Status.BAD_REQUEST, tSession);
        }

        // IF BIGGER THEN ALLOWED
        if(tContentLength > mMaxSize){
            return newCORSResponse(Response.Status.BAD_REQUEST, tSession);
        }

        try {
            boolean tOK = this.mFileChunkProcessor.appendToFile(tSession, tContentLength);
            if(!tOK){
                return newCORSResponse(Response.Status.BAD_REQUEST, tSession);
            }
            // 204 response
            return newCORSResponse(Response.Status.NO_CONTENT, tSession);
        } catch (Exception ex) {
            return newCORSResponse(Response.Status.BAD_REQUEST, tSession);
        }
    }

    ///////////////////////////////////////////////////////////////
    // HANDLE GET
    public Response handleGET(IHTTPSession tSession) {
        String tFilePath = tSession.getUri();

        // GET THE OFFSET AND LENGTH FROM THE PARAMETERS
        int tOffset;
        int tSize;
        List<String> tOffsetParam = tSession.getParameters().get("o");
        List<String> tSizeParam = tSession.getParameters().get("l");
        if(tOffsetParam != null && tOffsetParam.size() == 1 && tSizeParam != null &&  tSizeParam.size() == 1){
            tOffset = Integer.parseInt(tOffsetParam.get(0));
            tSize = Integer.parseInt(tSizeParam.get(0));
        } else {
            return newCORSResponse(Response.Status.BAD_REQUEST, tSession);
        }

        try {
            // READ THE FILE CHUNK
            byte[] tBuffer = this.mFileChunkProcessor.getFileChunk(tFilePath, tOffset, tSize);
            if(tBuffer.length == 0){
                return newCORSResponse(Response.Status.BAD_REQUEST, tSession);
            }

            Response tResponse;
            tResponse = newFixedLengthResponse(Response.Status.OK, "application/octet-stream",  new ByteArrayInputStream(tBuffer), tBuffer.length);

            // SET THE RESPONSE HEADERS
            addOriginHeaders(tResponse, tSession);

            return tResponse;
        } catch (Exception ex) {
            return newCORSResponse(Response.Status.BAD_REQUEST, tSession);
        }
    }

    ///////////////////////////////////////////////////////////////
    // ADD ORIGIN HEADERS
    private void addOriginHeaders(Response tResponse, IHTTPSession tSession) {
        String tOrigin = tSession.getHeaders().get("origin");

        if (tOrigin != null) {
            tResponse.addHeader("Access-Control-Allow-Origin", tOrigin);
            tResponse.addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, HEAD, OPTIONS");

            String tRequestHeaders = tSession.getHeaders().get("access-control-request-headers");
            if (tRequestHeaders != null) {
                tResponse.addHeader("Access-Control-Allow-Headers", tRequestHeaders);
            }
        }
    }

    ///////////////////////////////////////////////////////////////
    // NEW FILE CHUNK RESPONSE
    public Response newCORSResponse(Response.IStatus tStatus, IHTTPSession tSession) {
        Response tResponse = newFixedLengthResponse(tStatus, "text/plain", null, 0);

        // disables Gzip and thereby fixes weird timing-based broken pipe exceptions
        tResponse.addHeader("Content-Length", "0");

        addOriginHeaders(tResponse, tSession);

        return tResponse;
    }


}
