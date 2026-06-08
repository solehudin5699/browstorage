# Changelog

## 1.0.0 (2026-06-08)

### Features

* add cookie, locatStorage, & sessionStorage ([73983af](https://github.com/solehudin5699/browstorage/commit/73983afc838b3807733e9979917b57c30a7d5051))
* add handler limit cookie size, & add function clear per storage type ([eba61ee](https://github.com/solehudin5699/browstorage/commit/eba61ee1156f0adc1db46a94a2110ddc8295e806))
* add indexedDB ([7012c33](https://github.com/solehudin5699/browstorage/commit/7012c33e0ed8d128cfe36011e6eec23cfdc9b6a0))
* **encryption:** add checksum ([022009e](https://github.com/solehudin5699/browstorage/commit/022009e2b6ffa3ac13ce817016c2c940eee37942))
* **indexedDB:** eager connect for IndexedDB ([f852408](https://github.com/solehudin5699/browstorage/commit/f852408f41d3fee8d12487d5ec956d649a8fc85c))

### Bug Fixes

* **cookie:** pollution crash,property lookup,decode throws on malformed input,remove clear ([5dca734](https://github.com/solehudin5699/browstorage/commit/5dca7344730fe0d0a77244774c3f63edec6e0044))
* fix indexesMismatch on indexedDB ([df99484](https://github.com/solehudin5699/browstorage/commit/df994848ef0257013b378a7842e2b5220cf1ecef))
* fix overide encrypt on method key local/session/cookie ([cc111b9](https://github.com/solehudin5699/browstorage/commit/cc111b9dbca378dbfe87ecbbdfd80629f238feeb))
* fix set value undefined ([5603e4f](https://github.com/solehudin5699/browstorage/commit/5603e4f8d5f510884eaf2a7ebf8eaf9be48059bf))
* handle invalid date ttl ([8b5e867](https://github.com/solehudin5699/browstorage/commit/8b5e867224bc91bb022728ae751046ecaee155ab))
* handle NaN/infinity ttl ([c2d0802](https://github.com/solehudin5699/browstorage/commit/c2d08023e78b4079f810e3225fce1a456a67bbab))
* handle value '' on cookie set ([44c100c](https://github.com/solehudin5699/browstorage/commit/44c100c41402bc48822c676c5f2c97620f00ad68))
* handle value '' on cookie set ([32668f8](https://github.com/solehudin5699/browstorage/commit/32668f884454b8c7841aae6b15ded2cb7a0d1ce7))
* **has-method:** auto delete data if failed decrypt ([f254bab](https://github.com/solehudin5699/browstorage/commit/f254bab3e9dfafb49861bb04f229c5d6d1ab3da5))
* **indexedDB:** add throw error when multiple instance use conflict db name ([4e0ead8](https://github.com/solehudin5699/browstorage/commit/4e0ead867ebd75d0531181f797d24e0b03f3cba4))
* **indexedDB:** add throw error when multiple instance use conflict db name ([4f40b6b](https://github.com/solehudin5699/browstorage/commit/4f40b6b9e258299473a2779f41ff7d9c35e4f39a))
* **indexeddb:** automatically recreate store if keyPath/autoIncrement changes ([e8b7f94](https://github.com/solehudin5699/browstorage/commit/e8b7f940305012e9ba2ced97723badf572eaae5f))
* **indexedDB:** fix automigration ([8d85290](https://github.com/solehudin5699/browstorage/commit/8d85290c688b6bc2037210caabc33637fe635601))
* **indexedDB:** fix generic type only set level secureStore ([1649f3f](https://github.com/solehudin5699/browstorage/commit/1649f3f6f625ac7d27c7320d85923c9e77467160))
* **indexeddb:** fix minor ([c643a8c](https://github.com/solehudin5699/browstorage/commit/c643a8ce0e0711bf6a702aea12aa812074b662b8))
* **indexedDB:** fix potential race condition, handle missing _meta ([2c34d02](https://github.com/solehudin5699/browstorage/commit/2c34d02e40f2be1ce06f3fb7e36a1b81106fe6d1))
* **indexeddb:** handle tx.onabort to prevent hanging promises ([e4d8f72](https://github.com/solehudin5699/browstorage/commit/e4d8f72fa4e6fb357d47d454ec4e8b4303aa804d))
* **indexeddb:** index options not updated on migration ([eb9cc03](https://github.com/solehudin5699/browstorage/commit/eb9cc03b9f92df17d5ce76ff31c416f6180928a9))
* remove unused property on indexedDB ([dd400a7](https://github.com/solehudin5699/browstorage/commit/dd400a798615331e9a2e4c80530d38d0b3be8138))
* **ttl:** fix null crash parseTTL ([9c7f7e6](https://github.com/solehudin5699/browstorage/commit/9c7f7e6a1084b4584ad99d1241f90ba9b40c927e))
