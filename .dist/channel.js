"use strict";
var Channel = (function() {
  function Channel(peer, channel, channelHandler) {
    this._channel = channel;
    this._peer = peer;
    this.attachHandler(channelHandler);
  }
  return ($traceurRuntime.createClass)(Channel, {
    send: function(data) {
      this._channel.send(data);
    },
    sendJSON: function(data) {
      this._channel.send(JSON.stringify(data));
    },
    get label() {
      return this._channel.label;
    },
    get channel() {
      return this._channel;
    },
    get peer() {
      return this._peer;
    },
    attachHandler: function(channelHandler) {
      if (typeof channelHandler === 'function')
        channelHandler = channelHandler(this._channel);
      this.on(channelHandler || {});
    },
    on: function(event, listener) {
      var $__0 = this;
      if (typeof event == 'object') {
        for (var eventName in event)
          this.on(eventName, event[eventName]);
        return ;
      }
      this._channel.addEventListener(event, (function(event) {
        return listener($__0, event);
      }));
      return this;
    }
  }, {});
}());
Object.defineProperties(module.exports, {
  Channel: {get: function() {
      return Channel;
    }},
  __esModule: {value: true}
});

//# sourceMappingURL=channel.js.map