# capacitor-file-chunk
capacitor-file-chunk is a Capacitor plugin that enables reading and writing large files in chunks, without using a lot of memory and without using capacitor bridge and the base64 encoding. This plugin is based on the [capacitor-blob-writer](https://github.com/diachedelic/capacitor-blob-writer) plugin but adds the functionality of reading files as well.

To improve performance, this plugin does not check for permissions, so please ensure proper handling of permissions in your application.

<b>Please note that this is an initial release, and more documentation and demo software will be added in the future.<b>

## Install

```bash
npm install capacitor-file-chunk
npx cap sync
```
## TODO
- Demo program
- How to use it
