package io.qrclip.plugins.capfilechunk;

import android.util.Base64;

import org.libsodium.jni.NaCl;
import org.libsodium.jni.Sodium;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.util.Arrays;

import fi.iki.elonen.NanoHTTPD;

public class FileChunkProcessor {
    private final int mReadingChunkSize = 512 * 1024;
    private boolean mEncrypt = false;
    private byte[] mEncryptionKey = new byte[0];
    private static final int mIVLength = 12;
    private static final int mAuthenticationTagLength = 16;

    ///////////////////////////////////////////////////////////////
    // SET ENCRYPTION
    public boolean setEncryption(boolean tUseEncryption, String tKeyBase64) {
        // NO ENCRYPTION
        if(!tUseEncryption || tKeyBase64 == null || tKeyBase64.equals("")){
            this.mEncrypt = false;
            this.mEncryptionKey = new byte[0];
            return true;
        } else {
            // USING ENCRYPTION
            NaCl.sodium();
            this.mEncrypt = true;
            this.mEncryptionKey = Base64.decode(tKeyBase64, Base64.DEFAULT);
            return this.mEncryptionKey.length == 32;
        }
    }

    ///////////////////////////////////////////////////////////////
    // APPEND TO FILE
    public boolean appendToFile(NanoHTTPD.IHTTPSession tSession, long tContentLength) throws IOException {
        boolean tOK;
        if(this.mEncrypt){
            // WITH ENCRYPTION
            tOK = appendToFileWithEncryption(tSession, tContentLength);
        } else {
            // NO ENCRYPTION
            tOK = appendToFileNoEncryption(tSession, tContentLength);
        }
        return tOK;
    }

    ///////////////////////////////////////////////////////////////
    // ENCRYPT BUFFER
    public byte[] getFileChunk( String tFilePath, int tOffset, int tSize) {
        byte[] tBuffer = new byte[tSize];
        try (RandomAccessFile tRandomAccessFile = new RandomAccessFile(tFilePath, "r")) {
            tRandomAccessFile.seek(tOffset); // MOVE TO OFFSET
            tRandomAccessFile.read(tBuffer, 0, tSize); // THIS OFFSET IS NOT THE READING ONE :) JUST A NOTE
        } catch (IOException e) {
            return new byte[0];
        }

        if(this.mEncrypt){
            // WITH ENCRYPTION
            return this.encryptBuffer(tBuffer);
        } else {
            // NO ENCRYPTION
            return tBuffer;
        }
    }

    ///////////////////////////////////////////////////////////////
    // APPEND TO FILE WITH ENCRYPTION
    private boolean appendToFileWithEncryption(NanoHTTPD.IHTTPSession tSession, long tContentLength) throws IOException {
        String tDestPath = tSession.getUri();
        File tDestFile = new File(tDestPath);
        // WITH ENCRYPTION
        InputStream tInputStream = tSession.getInputStream();
        byte[] tDecryptedData = decryptInputStream(tInputStream, tContentLength);
        if(tDecryptedData.length>0){
            try (OutputStream tOutputStream = new FileOutputStream(tDestFile, true)) {
                tOutputStream.write(tDecryptedData, 0, tDecryptedData.length);
            }
        } else {
            return false;
        }
        return true;
    }

    ///////////////////////////////////////////////////////////////
    // APPEND TO FILE NO ENCRYPTION
    private boolean appendToFileNoEncryption(NanoHTTPD.IHTTPSession tSession, long tContentLength) {
        String tDestPath = tSession.getUri();
        File tDestFile = new File(tDestPath);
        byte[] tTempBuffer = new byte[this.mReadingChunkSize];
        int tBytesRead;
        long tTotalBytesRead = 0;
        InputStream tInputStream = tSession.getInputStream();
        // NO ENCRYPTION
        try (OutputStream tOutputStream = new FileOutputStream(tDestFile, true)) {
            while (tTotalBytesRead < tContentLength && (tBytesRead = tInputStream.read(tTempBuffer)) > 0) {
                tOutputStream.write(tTempBuffer, 0, tBytesRead);
                tTotalBytesRead += tBytesRead;
            }
        } catch (Exception ex) {
            return false;
        }
        return true;
    }

    ///////////////////////////////////////////////////////////////
    // READ ALL INPUT STREAM TO BUFFER
    private byte[] readAllInputStreamToBuffer(InputStream tInputStream, long tContentLength) throws IOException {
        // Read the entire input stream into a byte array
        ByteArrayOutputStream tByteArrayOutputStream = new ByteArrayOutputStream();

        byte[] tTempBuffer = new byte[this.mReadingChunkSize];
        int tBytesRead;
        long tTotalBytesRead = 0;

        while (tTotalBytesRead < tContentLength && (tBytesRead = tInputStream.read(tTempBuffer)) > 0) {
            tByteArrayOutputStream.write(tTempBuffer, 0, tBytesRead);
            tTotalBytesRead += tBytesRead;
        }
        tByteArrayOutputStream.flush();
        return tByteArrayOutputStream.toByteArray();
    }

    ///////////////////////////////////////////////////////////////
    // DECRYPT INPUT STREAM
    private byte[] decryptInputStream(InputStream tInputStream, long tContentLength) throws IOException {
        // READ THE ENTIRE INPUT STREAM TO THE ARRAY
        byte[] tIvAndEncryptedDataArray = readAllInputStreamToBuffer(tInputStream, tContentLength);

        // Extract the nonce (IV) and encrypted data
        int tEncryptedDataLength = tIvAndEncryptedDataArray.length - mIVLength;
        int tDecryptedDataLength = tIvAndEncryptedDataArray.length - mIVLength - mAuthenticationTagLength;
        byte[] tIV = new byte[mIVLength];
        byte[] tEncryptedData = new byte[tEncryptedDataLength];
        System.arraycopy(tIvAndEncryptedDataArray, 0, tIV, 0, mIVLength);
        System.arraycopy(tIvAndEncryptedDataArray, mIVLength, tEncryptedData, 0, tEncryptedDataLength);

        // Decrypt the data
        byte[] tDecryptedData = new byte[tDecryptedDataLength];
        try {
            int tRet = Sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
                    tDecryptedData,
                    new int[1],
                    new byte[0],
                    tEncryptedData,
                    tEncryptedDataLength,
                    new byte[0],
                    0,
                    tIV,
                    this.mEncryptionKey);

            if (tRet != 0) {
                return new byte[0];
            }
        } catch (Exception ex) {
            return new byte[0];
        }

        return tDecryptedData;
    }

    ///////////////////////////////////////////////////////////////
    // ENCRYPT BUFFER
    private byte[] encryptBuffer(byte[] tBuffer) {
        // Generate a random nonce (IV)
        byte[] tIV = new byte[mIVLength];
        Sodium.randombytes(tIV, mIVLength);

        // Encrypt the buffer
        int tEncryptedDataLength = tBuffer.length + mAuthenticationTagLength;
        byte[] tEncryptedData = new byte[tEncryptedDataLength];

        int[] tActualEncryptedDataLength = new int[1];
        int tRet = Sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
                tEncryptedData,
                tActualEncryptedDataLength,
                tBuffer, tBuffer.length,
                new byte[0],
                0,
                new byte[0], tIV, mEncryptionKey);

        if (tRet != 0) {
            // Encryption failed, handle the error
            throw new IllegalStateException("Encryption failed");
        }

        // Truncate the encryptedData array if needed
        if (tActualEncryptedDataLength[0] != tEncryptedDataLength) {
            tEncryptedData = Arrays.copyOf(tEncryptedData, (int) tActualEncryptedDataLength[0]);
        }

        // Prepend the nonce (IV) to the encrypted data
        byte[] tOutputArray = new byte[mIVLength + tEncryptedData.length];
        System.arraycopy(tIV, 0, tOutputArray, 0, mIVLength);
        System.arraycopy(tEncryptedData, 0, tOutputArray, mIVLength, tEncryptedData.length);

        return tOutputArray;
    }
}
