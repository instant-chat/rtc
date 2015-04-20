"use strict";
var Stream = (function() {
  function Stream(peer, stream, streamListeners) {
    this._peer = peer;
    this._stream = stream;
    this._id = stream.id;
  }
  return ($traceurRuntime.createClass)(Stream, {
    get stream() {
      return this._stream;
    },
    get id() {
      return this._id;
    },
    get peer() {
      return this._peer;
    }
  }, {});
}());
Object.defineProperties(module.exports, {
  Stream: {get: function() {
      return Stream;
    }},
  __esModule: {value: true}
});

//# sourceMappingURL=stream.js.map