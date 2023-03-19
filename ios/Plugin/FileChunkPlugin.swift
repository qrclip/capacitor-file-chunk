import Foundation
import GCDWebServer
import Capacitor

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitorjs.com/docs/plugins/ios
 */
@objc(FileChunkPlugin)
public class FileChunkPlugin: CAPPlugin {
    private var _server: GCDWebServer? = nil
    private let _authToken = UUID().uuidString

    // LOAD
    @objc public override func load() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(startServer),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
        if UIApplication.shared.applicationState == .active {
            startServer()
        }
    }

    // START SERVER
    @objc private func startServer() {
        if _server != nil {
            // already started
            return
        }

        // listen for errors only
        GCDWebServer.setLogLevel(4)

        // find an available port and listen on it
        var retriesLeft = 5
        while(_server == nil && retriesLeft > 0) {
            let server = GCDWebServer()

            // OPTIONS
            server.addDefaultHandler(forMethod: "OPTIONS", request: GCDWebServerRequest.self, processBlock: handleOPTIONSRequest)

            // GET
            server.addDefaultHandler(forMethod: "GET", request: GCDWebServerURLEncodedFormRequest.self, processBlock: handleGETRequest)

            // PUT
            server.addDefaultHandler(forMethod: "PUT", request: GCDWebServerDataRequest.self, processBlock: handlePUTRequest)

            // select a random, private port
            let port = UInt.random(in: 49151..<65536)
            do {
                try server.start(options: [
                    GCDWebServerOption_Port: port,
                    GCDWebServerOption_BindToLocalhost: true,
                    GCDWebServerOption_AutomaticallySuspendInBackground: true,
                ])

                // success
                if server.serverURL != nil {
                    CAPLog.print("FileChunk listening at \(server.serverURL!.absoluteString)")
                    _server = server
                    break
                } else {
                    CAPLog.print("FileChunk failed to start on port \(port)")
                }
            } catch {
                CAPLog.print("FileChunk failed to start on port \(port)", error)
            }

            retriesLeft -= 1
        }
    }

    // HANDLE OPTIONS
    private func handleOPTIONSRequest(request: GCDWebServerRequest) -> GCDWebServerResponse? {
        return self.emptyCorsResponse(statusCode: 200, request: request)
    }

    // HANDLE PUT
    private func handlePUTRequest(request: GCDWebServerRequest) -> GCDWebServerResponse? {
        if request.headers["Authorization"] != self._authToken {
            return self.emptyCorsResponse(statusCode: 401, request: request)
        }

        guard let dataRequest = request as? GCDWebServerDataRequest else {
            CAPLog.print("FileChunk Failed to cast request to GCDWebServerDataRequest")
            return self.emptyCorsResponse(statusCode: 400, request: request)
        }

        let data = dataRequest.data
        let array = [UInt8](data)

        guard let outputStream = OutputStream(url: URL(fileURLWithPath: dataRequest.path), append: true) else {
            CAPLog.print("FileChunk Failed to open file")
            return self.emptyCorsResponse(statusCode: 400, request: request)
        }

        outputStream.open()
        let tWriteResult = outputStream.write(array, maxLength: data.count)
        outputStream.close()
        if (tWriteResult <= 0){
            CAPLog.print("FileChunk Failed to append to file")
            return self.emptyCorsResponse(statusCode: 400, request: request)
        }

        return self.emptyCorsResponse(statusCode: 204, request: request)
    }

    // HANDLE GET
    private func handleGETRequest(request: GCDWebServerRequest) -> GCDWebServerResponse? {
        if request.headers["Authorization"] != self._authToken {
            return self.emptyCorsResponse(statusCode: 401, request: request)
        }

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

        guard let fileHandle = FileHandle(forReadingAtPath: request.path) else {
            CAPLog.print("FileChunk Failed to open file for reading")
            return self.emptyCorsResponse(statusCode: 400, request: request)
        }
        defer {
            fileHandle.closeFile()
        }

        fileHandle.seek(toFileOffset: tOffset)

        let data = fileHandle.readData(ofLength: tLength)

        fileHandle.closeFile()

        let response =  GCDWebServerDataResponse(data: data, contentType: "application/octet-stream")
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

        return response
    }

    // CONNECT INFO
    @objc func connectInfo(_ call: CAPPluginCall) {
        if _server?.serverURL != nil && _server!.isRunning {
            var baseUrl = _server!.serverURL!.absoluteString

            if baseUrl.last == "/" {
                baseUrl = String(baseUrl.dropLast())
            }
            let authToken = _authToken
            call.resolve([
                "version": 1,
                "platform": "ios",
                "baseUrl": baseUrl,
                "AuthToken": authToken,
                "chunkSize": 10024000
            ])
        } else {
            call.resolve([
                "version": 1,
                "platform": "ios",
                "baseUrl": "",
                "AuthToken": "0",
                "chunkSize": 0
            ])
        }
    }

    // EMPTY CORS RESPONSE
    private func emptyCorsResponse(
        statusCode: Int,
        request: GCDWebServerRequest
    ) -> GCDWebServerResponse {
        let response = GCDWebServerResponse(statusCode: statusCode)
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

        return response
    }
}


