import Foundation
import CryptoKit

class FileChunkProcessor {
    private var mEncrypt: Bool
    private var mEncryptionKey: SymmetricKey? = nil

    // INIT
    init() {
        self.mEncrypt = false
        self.mEncryptionKey = nil
    }

    // SET CONFIGURATION
    public func setConfiguration(useEncryption: Bool, keyBase64: String) {
        if !useEncryption || keyBase64.isEmpty {
            self.mEncrypt = false
            self.mEncryptionKey = nil
        } else {
            self.mEncrypt = true
            self.mEncryptionKey = symmetricKeyFromBase64(base64String: keyBase64)
        }
    }
    
    // PROCESS DECRYPTION
    public func processDecryption(data: Data) -> [UInt8] {
        if !mEncrypt {
            return [UInt8](data)
        }
        
        if mEncryptionKey == nil {
            return []
        }
        
        if let decryptedData = chacha20Poly1305Decrypt(key: mEncryptionKey!, combinedData: data) {
            return [UInt8](decryptedData)
        }
        
        return []
    }
    
    // PROCESS ENCRYPTION
    public func processEncryption(data: Data) -> Data {
        if !mEncrypt {
            return data
        }
        if mEncryptionKey == nil {
            return Data()
        }
         if let (encryptedData) = chacha20Poly1305Encrypt(key: mEncryptionKey!, data: data) {
            return encryptedData
        }
        return Data()
    }
    
    // KEY FROM BASE 64
    private func symmetricKeyFromBase64(base64String: String) -> SymmetricKey? {
        guard let keyData = Data(base64Encoded: base64String) else {
            return nil
        }
        return SymmetricKey(data: keyData)
    }
    
    // CHACHA20POLY1305 ENCRYPT
    private func chacha20Poly1305Decrypt(key: SymmetricKey, combinedData: Data) -> Data? {
        guard let sealedBox = try? ChaChaPoly.SealedBox(combined: combinedData),
              let decryptedData = try? ChaChaPoly.open(sealedBox, using: key) else {
            return nil
        }
        return decryptedData
    }
        
    // CHACHA20POLY1305 ENCRYPT
    private func chacha20Poly1305Encrypt(key: SymmetricKey, data: Data) -> Data? {
        let nonce = ChaChaPoly.Nonce()
        guard let sealedBox = try? ChaChaPoly.seal(data, using: key, nonce: nonce) else {
            return nil
        }
        return sealedBox.combined
    }
    
}
