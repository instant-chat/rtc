class Channel {
  constructor(peer, channel, channelHandler) {
    this._channel = channel;
    this._peer = peer;

    this.attachHandler(channelHandler);
  }

  send(data) { this._channel.send(data); }
  sendJSON(data) { this._channel.send(JSON.stringify(data)); }

  get label() { return this._channel.label; }
  get channel() { return this._channel; }
  get peer() { return this._peer; }

  attachHandler(channelHandler) {
    if (typeof channelHandler === 'function') channelHandler = channelHandler(this._channel);

    this.on(channelHandler || {});
  }

  /*
  +  Event Handling
  */
  on(event, listener) {
    if (typeof event == 'object') {
      for (var eventName in event) this.on(eventName, event[eventName]);
      return;
    }

    this._channel.addEventListener(event, event => listener(this, event));

    return this;
  }
  /*
  -  Event Handling
  */
}

export {Channel};