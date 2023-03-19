# capacitor-file-chunk
capacitor-file-chunk is a Capacitor plugin ( Android & iOS ) that enables reading and writing large files in chunks, without using a lot of memory and without using capacitor bridge and the base64 encoding. This plugin is based on the [capacitor-blob-writer](https://github.com/diachedelic/capacitor-blob-writer) plugin but adds the functionality of reading files as well.

To improve performance, this plugin does not check for permissions, so please ensure proper handling of permissions in your application.

**Please note that this is an initial release, and more documentation and demo software will be added in the future.**

## Install

```bash
npm install capacitor-file-chunk
npx cap sync
```
## USE
To connect to the plugin and get the info needed

```
const tFileChunkInfo = await FileChunk.connectInfo();
```

To get a file chunk
```
try {
    const tOffset = 0;
    const tLength = 1024;
    const tUrl = tFileChunkInfo.baseUrl 
                 + '/path/to/file'
                 + '?o=' + tOffset.toString() 
                 + '&l=' + tLength.toString();
    const tResp = await fetch(
    tUrl, {
    headers: { authorization: tFileChunkInfo.authToken },
    method: 'get',
    });
    await tResp.arrayBuffer()
}
```

To save a file chunk
```
try {
    const tChunkBlob = new Blob([]); // YOUR BLOB DATA
    const tUrl = tFileChunkInfo.baseUrl + '/path/to/file'
    await fetch(tUrl, {
            headers: { authorization: tFileChunkInfo.authToken },
            method: 'put',
            body: tChunkBlob,
          });
}
```

**Security Warning**: This Capacitor plugin currently uses HTTP for localhost communication. Although intercepting localhost HTTP traffic typically requires root access on a device, keep in mind that malicious apps with root access can already access and manipulate your data. Nevertheless, it is essential to follow best security practices to mitigate potential attacks. Using HTTPS with a self-signed certificate is recommended for better security, please be aware that using HTTP may still expose you to certain risks. Remember, when you use HTTPS, the chances of bad things happening are significantly reduced; however, when using HTTP, potential vulnerabilities may arise.

## TODO
- Demo program
- How to use it
- HTTPS

