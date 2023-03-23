export class DataConverterHelper {
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // CONVERT TO BASE 64
  public static ConvertBlobToBase64 = (blob: Blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.readAsDataURL(blob);
    });

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // CONVERT BASE64 TO UINT8ARRAY
  public static base64ToUint8Array(base64: string): Uint8Array {
    try {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } catch (e) {
      return new Uint8Array(0);
    }
  }
}
