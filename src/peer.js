import {Channel} from './channel';
import {Stream} from './stream';

var _ = require('lodash'),
    emitter = require('es-emitter')();


var RTCPeerConnection = (window.PeerConnection || window.webkitPeerConnection00 || window.webkitRTCPeerConnection || window.mozRTCPeerConnection);
var RTCSessionDescription = (window.mozRTCSessionDescription || window.RTCSessionDescription);
var RTCIceCandidate = (window.mozRTCIceCandidate || window.RTCIceCandidate);

var CONNECTION_EVENTS = ['negotiation_needed', 'ice_candidate', 'signaling_state_change',
                         'add_stream', 'remove_stream', 'ice_connection_state_change',
                         'data_channel'];

var iceServers = {
  iceServers: [
    {url: 'stun:104.131.128.101:3478', urls: 'stun:104.131.128.101:3478'},
    {url: 'turn:104.131.128.101:3478', urls: 'turn:104.131.128.101:3478', username: 'turn', credential: 'turn'}
  ],
  iceTransports: 'all'
};

class Peer {
  constructor(id, config) {
    this._id = id;
    this._config = config;
    this._remoteCandidates = [];
    this._localCandidates = [];
    this._remoteStreams = [];
    this._localStreams = [];
    this._channels = {};
    this._events = {};

    this._isConnectingPeer = false;
    this._connectPromise = null;

    this._connectCalled = false;
    this._connected = false;

    this._isReadyForIceCandidates = false;
    this._iceCandidatePromises = [];

    this._nextChannelID = 0;

    this._log = [];

    var connection = this._connection = new RTCPeerConnection(iceServers);

    var {emit, on, off} = emitter({
      attemptIntercept: (event, listener) => {
        if (connection && CONNECTION_EVENTS.indexOf(event) != -1) {
          connection.addEventListener(event.replace(/_/g, ''), listener);
          return true;
        }
        return false;
      }
    });

    this.fire = emit;
    this.on = on;
    this.off = off;

    this.on({
      'ice_candidate':  event => this._localCandidates.push(event.candidate),
      'data_channel':   event => this._addChannel(event.channel),
      'add_stream':     event => this._addRemoteStream(event.stream)
    });

    this.on({
      'ice_connection_state_change': event => {
        switch (connection.iceConnectionState) {
          case 'connected':
          case 'completed':
            this._connected = true;
            console.log('connected!');
            break;
          case 'failed':
          case 'disconnected':
          case 'closed':
            this._connected = false;
            this.fire('disconnected');
        }
      }
    });
  }

  connect() {
    this._isConnectingPeer = true;

    this._connectPromise = this._connectPromise || new Promise((resolve, reject) => {
      var connectWatcher = event => {
        this._connectCalled = true;

        var connection = event.target;

        switch (connection.iceConnectionState) {
          case 'connected':
          case 'completed':
            this._connected = true;
            connection.removeEventListener('iceconnectionstatechange', connectWatcher);
            resolve(this);
            break;
          case 'failed':
          case 'disconnected':
          case 'closed':
            connection.removeEventListener('iceconnectionstatechange', connectWatcher);
            reject({peer: this, event: event});
            break;
        }
      };

      this._connection.addEventListener('iceconnectionstatechange', connectWatcher);

      this.initiateOffer()
        .then(offer => this.fire('offer ready', offer))
        .catch(error => this.fire('offer error'));
    });

    return this._connectPromise;
  }

  initiateOffer(options) {
    options = options || {mandatory: {OfferToReceiveAudio: true, OfferToReceiveVideo: true}};
    return new Promise((resolve, reject) => {
      this._connection.createOffer(
        offer =>
          this._connection
              .setLocalDescription(offer,
                () => resolve(this._connection.localDescription),
                error => reject('peer error set_local_description', this, error, offer)),
        error => reject(error),
        options);
    });
  }

  receiveOffer(offer) {
    return new Promise((resolve, reject) => {
      this._connection.setRemoteDescription(new RTCSessionDescription(offer),
        () => {
          this._resolveIceCandidatePromises();
          this._connection.createAnswer(
            answer => {
              this._connection.setLocalDescription(answer, () => resolve(this._connection.localDescription), error => reject('peer error set_local_description', this, error, answer));
            },
            error => reject('peer error send answer', this, error, offer));
        },
        error => reject('peer error set_remote_description', this, error, offer));
    });
  }

  receiveAnswer(answer) {
    return new Promise((resolve, reject) => this._connection.setRemoteDescription(new RTCSessionDescription(answer), () => {
      this._resolveIceCandidatePromises();
      resolve();
    }, reject));
  }

  addIceCandidates(candidates) {
    return new Promise((outerResolve, outerReject) => {
      _.each(candidates, candidate => {
        this._iceCandidatePromises.push(() => {
          return new Promise((resolve, reject) => {
            this._connection.addIceCandidate(new RTCIceCandidate(candidate), () => {
              this._remoteCandidates.push(candidate);
              resolve();
            }, error => {
              reject(error);
            });
          });
        });
      });

      this._resolveIceCandidatePromises(outerResolve, outerReject);
    });
  }

  addChannel(label, options, channelHandler) {
    label = label || ('data-channel-' + this._nextChannelID++);
    // options = options || {};
    // options.negotiated = false;

    var channel = this._addChannel(this._connection.createDataChannel(label, options), channelHandler);

    return channel;
  }

  removeChannel(label) {
    var channel = this._channels[label];
    if (channel) {
      delete this._channels[label];
      this.fire('channel removed', channel);
    }
  }

  addLocalStream(stream) {
    var localStream = new Stream(this, stream);

    this._localStreams.push(localStream);

    this._addLocalStream(stream);

    return localStream;
  }

  removeStream(stream) {
    var index = this._localStreams.indexOf(stream);
    if (index != 1) {
      this._localStreams.splice(index, 1);
      this._connection.removeStream(stream.stream);
    }
  }

  forwardStream(stream) {
    this._localStreams.push(stream);
    this._addLocalStream(stream.stream);
  }

  close() {
    if (this._connection && this._connection.iceConnectionState != 'closed') this._connection.close();
  }

  getStats() {
    return new Promise((resolve, reject) => {
      this._connection.getStats(resolve, reject);
    });
  }

  get id() { return this._id; }
  get config() { return this._config; }
  get localStreams() { return this._localStreams; }
  get remoteStreams() { return this._remoteStreams; }
  get channels() { return this._channels; }
  get isConnectingPeer() { return this._isConnectingPeer; }
  get log() { return this._log; }

  //channel(label) { return this._channels[label]; }

  channel(label) {
    var promises = this._channelPromises = this._channelPromises || {};

    var promise = promises[label] = promises[label] || new Promise((resolve, reject) => {
      var channel = this._channels[label];

      if (channel) resolve(channel);
      else {
        var listener = channel => {
          if (channel.label == label) {
            this.off('channel add', listener);
            resolve(channel);
          }
        };

        this.on('channel add', listener);
      }
    });

    return promise;
  }

  stream(id) { return _.find(this._remoteStreams, {'id': id}); }

  // Do we want to expose this?!
  get connection() { return this._connection; }

  _addChannel(channel) {
    channel = new Channel(this, channel);

    channel.on({
      'close': () => this.removeChannel(channel.label)
    });

    this._channels[channel.label] = channel;

    this.fire('channel add', channel);

    return channel;
  }

  _addLocalStream(stream) {
    this._connection.addStream(stream);
    console.log('_adding local stream');
    // This might not be a good idea. What happens if
    // _addLocalStream is called again before the offer is full resolved?
    if (this._connected) {
      this.initiateOffer()
        .then(offer => this.fire('offer ready', offer))
        .catch(error => {
          console.log(error);
          this.fire('offer error');
        });
    }
    this.fire('localStream add', stream);
    return stream;
  }

  _addRemoteStream(stream) {
    console.log('add remote stream');
    stream = new Stream(this, stream);
    this._remoteStreams.push(stream);
    this.fire('remoteStream add', stream);
    return stream;
  }

  _resolveIceCandidatePromises(resolve, reject) {
    if (this._connection.signalingState != 'have-local-offer' && this._connection.remoteDescription) {
      Promise
        .all(_.map(this._iceCandidatePromises, fn => {return fn();}))
        .then(() => resolve())
        .catch(reject);

      this._iceCandidatePromises.splice(0);
    }
  }

  _log() {
    this._log.push({
      at: new Date(),
      args: [...arguments]
    });
  }
}

export {Peer};