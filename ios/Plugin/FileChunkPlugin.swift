import Foundation
import GCDWebServer
import Capacitor

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitorjs.com/docs/plugins/ios
 */
@objc(FileChunkPlugin)
public class FileChunkPlugin: CAPPlugin {
    private var mServer: GCDWebServer? = nil
    private var mFileChunkProcessor: FileChunkProcessor = FileChunkProcessor()
    private let mAuthToken = UUID().uuidString
    private var mMaxBodySize: UInt = 0;
    
    // START SERVER
    @objc func startServer(_ call: CAPPluginCall) {
        // GET START PARAMETERS
        let tEncryptionKeyBase64 = call.getString("key", "");
        let tUseEncryption = call.getBool("encryption", false)
        let tPort = UInt(call.getInt("port", 0));
        let tPortMin = UInt(call.getInt("portMin", 49151));
        let tPortMax = UInt(call.getInt("portMax", 65536));
        let tRetries = UInt(call.getInt("retries", 5));
        var tChunkSize = UInt(call.getInt("chunkSize", 10024000));
        
        // SET THE MAXIMUM CONTENT LENGTH
        mMaxBodySize = tChunkSize;
        if tUseEncryption {
            mMaxBodySize += 12 + 16; // THE IV AND AUTH TAG
        }

        // IT HAS TO BE STARTED IN THE MAIN THREAD
        DispatchQueue.main.async {
            // INIT THE SERVER INSTANCE
            self.initTheServerInstance(port:tPort, portMin:tPortMin, portMax:tPortMax, retries:tRetries);

            // IF SERVER STARTED
            if self.mServer?.serverURL != nil && self.mServer!.isRunning {
                var baseUrl = self.mServer!.serverURL!.absoluteString
                if baseUrl.last == "/" {
                    baseUrl = String(baseUrl.dropLast())
                }

                // SET CONFIGURATION OF THE PROCESSOR
                self.mFileChunkProcessor.setConfiguration(useEncryption: tUseEncryption, keyBase64: tEncryptionKeyBase64)

                var tEncryptionType = "none"
                if tUseEncryption == true {
                    tEncryptionType = "ChaCha20-Poly1305"
                }
                // SEND THE INFO
                call.resolve([
                    "version": 2,
                    "platform": "ios",
                    "baseUrl": baseUrl,
                    "authToken": self.mAuthToken,
                    "encryptionType": tEncryptionType,
                    "chunkSize": tChunkSize,
                    "ready": true
                ])
            } else {
                // ERROR STARTING SEND THE INFO
                call.resolve([
                    "version": 2,
                    "platform": "ios",
                    "baseUrl": "",
                    "authToken": "",
                    "encryptionType": "none",
                    "chunkSize": 0,
                    "ready": false
                ])
            }
        }
    }
    
    // STOP SERVER
    @objc func stopServer(_ call: CAPPluginCall) {
        if mServer != nil {
            mServer?.stop()
            mServer = nil
        }
        call.resolve()
    }
    
    // READ FILE CHUNK
    @objc func readFileChunk(_ call: CAPPluginCall) {
        let tPath = call.getString("path", "");
        let tOffset = UInt64(call.getInt("offset", 0));
        let tLength = Int(call.getInt("length", 0));
        
        // GET THE FILE HANDLE AND READ THE CHUNK
        guard let fileHandle = FileHandle(forReadingAtPath: tPath) else {
            call.resolve(["data":""])
            return;
        }
        defer {
            fileHandle.closeFile()
        }
        fileHandle.seek(toFileOffset: tOffset)
        var data = fileHandle.readData(ofLength: tLength)
        fileHandle.closeFile()
        call.resolve(["data":data.base64EncodedString()])
    }
    
    // HANDLE OPTIONS
    private func handleOPTIONSRequest(request: GCDWebServerRequest) -> GCDWebServerResponse? {
        return self.emptyCorsResponse(statusCode: 200, request: request)
    }
    
    // HANDLE PUT
    private func handlePUTRequest(request: GCDWebServerRequest) -> GCDWebServerResponse? {
        if request.contentLength > mMaxBodySize {
            return self.emptyCorsResponse(statusCode: 400, request: request)
        }
        
        if request.headers["Authorization"] != self.mAuthToken {
            return self.emptyCorsResponse(statusCode: 401, request: request)
        }
                
        guard let dataRequest = request as? GCDWebServerDataRequest else {
            CAPLog.print("FileChunk Failed to cast request to GCDWebServerDataRequest")
            return self.emptyCorsResponse(statusCode: 400, request: request)
        }
        
        let data = dataRequest.data
        
        // PROCESS THE DATA (ENCRYPT OR NOT)
        let array = mFileChunkProcessor.processDecryption(data: data)
        
        // APPEND TO FILE
        guard let outputStream = OutputStream(url: URL(fileURLWithPath: dataRequest.path), append: true) else {
            CAPLog.print("FileChunk Failed to open file")
            return self.emptyCorsResponse(statusCode: 400, request: request)
        }
        outputStream.open()
        let tWriteResult = outputStream.write(array, maxLength: array.count)
        outputStream.close()
        if (tWriteResult <= 0){
            CAPLog.print("FileChunk Failed to append to file")
            return self.emptyCorsResponse(statusCode: 400, request: request)
        }
        
        // IF OK RETURN STATUS 204
        return self.emptyCorsResponse(statusCode: 204, request: request)
    }
    
    // HANDLE GET
    private func handleGETRequest(request: GCDWebServerRequest) -> GCDWebServerResponse? {
        if request.headers["Authorization"] != self.mAuthToken {
            return self.emptyCorsResponse(statusCode: 401, request: request)
        }
        
        // GET PARAMETERS ( OFFSET AND LENGTH )
        var tOffset : UInt64 = 0
        var tLength : Int = 0
        if let offsetString = request.query?["o"], let tFoundOffset = UInt64(offsetString) {
            tOffset = tFoundOffset
        }
        if let lengthString = request.query?["l"], let tFoundLength = Int(lengthString) {
            tLength = tFoundLength
        }
        if tLength <= 0 {
            return self.emptyCorsResponse(statusCode: 401, request: request)
        }
        
        // GET THE FILE HANDLE AND READ THE CHUNK
        guard let fileHandle = FileHandle(forReadingAtPath: request.path) else {
            CAPLog.print("FileChunk Failed to open file for reading")
            return self.emptyCorsResponse(statusCode: 400, request: request)
        }
        defer {
            fileHandle.closeFile()
        }
        fileHandle.seek(toFileOffset: tOffset)
        var data = fileHandle.readData(ofLength: tLength)
        fileHandle.closeFile()
        
        // PROCESS THE CHUNK ( ENCRYPT OR NOT )
        data = mFileChunkProcessor.processEncryption(data: data)
        
        // SEND THE CHUNK
        let response =  GCDWebServerDataResponse(data: data, contentType: "application/octet-stream")
        addOriginToResponse(request: request, response: response)
        return response
    }
    
    // INIT THE SERVER INSTANCE
    private func initTheServerInstance( port: UInt,portMin: UInt,portMax: UInt,retries: UInt) {
        if mServer != nil {
            // already started
            return
        }
        
        // listen for errors only
        GCDWebServer.setLogLevel(4)
        
        // IF THERES A PORT ASKED START WITH THAT
        if port > 0 {
            startServerAtPort(port: port );
            if mServer != nil {
                return;
            }
            if retries == 0 { // IN CASE RETRIES IS SET TO ZERO DO NOT TRY MORE IF FAIL
                return;
            }
        }
        
        // FIND A PORT
        var tRetriesLeft = retries
        while(mServer == nil && tRetriesLeft > 0) {
            // select a random, private port
            let tPort2Try = UInt.random(in: portMin..<portMax)
            startServerAtPort(port: tPort2Try );
            if mServer != nil {
                break
            }
            tRetriesLeft -= 1
        }
    }
    
    // START SERVER AT PORT
    private func startServerAtPort(port: UInt) {
        let tServer = GCDWebServer()
        // OPTIONS
        tServer.addDefaultHandler(forMethod: "OPTIONS", request: GCDWebServerRequest.self, processBlock: handleOPTIONSRequest)
        tServer.addDefaultHandler(forMethod: "OPTIONS", request: GCDWebServerRequest.self, processBlock: handleOPTIONSRequest)
        
        // GET
        tServer.addDefaultHandler(forMethod: "GET", request: GCDWebServerURLEncodedFormRequest.self, processBlock: handleGETRequest)
        
        // PUT
        tServer.addDefaultHandler(forMethod: "PUT", request: GCDWebServerDataRequest.self, processBlock: handlePUTRequest)
        tServer.addDefaultHandler(forMethod: "PUT", request: GCDWebServerDataRequest.self, processBlock: handlePUTRequest)
        
        // TRY TO START
        do {
            try tServer.start(options: [
                GCDWebServerOption_Port: port,
                GCDWebServerOption_BindToLocalhost: true,
                GCDWebServerOption_AutomaticallySuspendInBackground: true,
            ])
            // SUCCESS
            if tServer.serverURL != nil {
                CAPLog.print("FileChunk listening at \(tServer.serverURL!.absoluteString)")
                mServer = tServer
            } else {
                CAPLog.print("FileChunk failed to start on port \(port)")
            }
        } catch {
            CAPLog.print("FileChunk failed to start on port \(port)", error)
        }
        
    }
    
    // EMPTY CORS RESPONSE
    private func emptyCorsResponse(statusCode: Int, request: GCDWebServerRequest) -> GCDWebServerResponse {
        let response = GCDWebServerResponse(statusCode: statusCode)
        addOriginToResponse(request: request, response: response)
        return response
    }
    
    // ADD ORIGIN TO RESPONSE
    private func addOriginToResponse(request: GCDWebServerRequest, response: GCDWebServerResponse) {
        let origin = request.headers["Origin"]
        if origin != nil {
            response.setValue(
                origin,
                forAdditionalHeader: "Access-Control-Allow-Origin"
            )
            response.setValue(
                "GET, POST, PUT, HEAD, OPTIONS",
                forAdditionalHeader: "Access-Control-Allow-Methods"
            )
            let requestHeaders = request.headers["Access-Control-Request-Headers"]
            if (requestHeaders != nil) {
                response.setValue(
                    requestHeaders,
                    forAdditionalHeader: "Access-Control-Allow-Headers"
                )
            }
        }
    }
}


