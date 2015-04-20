"use strict";
var $__channel__,
    $__stream__;
var Channel = ($__channel__ = require("./channel"), $__channel__ && $__channel__.__esModule && $__channel__ || {default: $__channel__}).Channel;
var Stream = ($__stream__ = require("./stream"), $__stream__ && $__stream__.__esModule && $__stream__ || {default: $__stream__}).Stream;
var _ = require('lodash'),
    emitter = require('es-emitter')();
var RTCPeerConnection = (window.PeerConnection || window.webkitPeerConnection00 || window.webkitRTCPeerConnection || window.mozRTCPeerConnection);
var RTCSessionDescription = (window.mozRTCSessionDescription || window.RTCSessionDescription);
var RTCIceCandidate = (window.mozRTCIceCandidate || window.RTCIceCandidate);
var CONNECTION_EVENTS = ['negotiation_needed', 'ice_candidate', 'signaling_state_change', 'add_stream', 'remove_stream', 'ice_connection_state_change', 'data_channel'];
var iceServers = {
  iceServers: [{
    url: 'stun:104.131.128.101:3478',
    urls: 'stun:104.131.128.101:3478'
  }, {
    url: 'turn:104.131.128.101:3478',
    urls: 'turn:104.131.128.101:3478',
    username: 'turn',
    credential: 'turn'
  }],
  iceTransports: 'all'
};
var Peer = (function() {
  function Peer(id, config) {
    var $__2 = this;
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
    var $__4 = emitter({attemptIntercept: (function(event, listener) {
        if (connection && CONNECTION_EVENTS.indexOf(event) != -1) {
          connection.addEventListener(event.replace(/_/g, ''), listener);
          return true;
        }
        return false;
      })}),
        emit = $__4.emit,
        on = $__4.on,
        off = $__4.off;
    this.fire = emit;
    this.on = on;
    this.off = off;
    this.on({
      'ice_candidate': (function(event) {
        return $__2._localCandidates.push(event.candidate);
      }),
      'data_channel': (function(event) {
        return $__2._addChannel(event.channel);
      }),
      'add_stream': (function(event) {
        return $__2._addRemoteStream(event.stream);
      })
    });
    this.on({'ice_connection_state_change': (function(event) {
        switch (connection.iceConnectionState) {
          case 'connected':
          case 'completed':
            $__2._connected = true;
            console.log('connected!');
            break;
          case 'failed':
          case 'disconnected':
          case 'closed':
            $__2._connected = false;
            $__2.fire('disconnected');
        }
      })});
  }
  return ($traceurRuntime.createClass)(Peer, {
    connect: function() {
      var $__2 = this;
      this._isConnectingPeer = true;
      this._connectPromise = this._connectPromise || new Promise((function(resolve, reject) {
        var connectWatcher = (function(event) {
          $__2._connectCalled = true;
          var connection = event.target;
          switch (connection.iceConnectionState) {
            case 'connected':
            case 'completed':
              $__2._connected = true;
              connection.removeEventListener('iceconnectionstatechange', connectWatcher);
              resolve($__2);
              break;
            case 'failed':
            case 'disconnected':
            case 'closed':
              connection.removeEventListener('iceconnectionstatechange', connectWatcher);
              reject({
                peer: $__2,
                event: event
              });
              break;
          }
        });
        $__2._connection.addEventListener('iceconnectionstatechange', connectWatcher);
        $__2.initiateOffer().then((function(offer) {
          return $__2.fire('offer ready', offer);
        })).catch((function(error) {
          return $__2.fire('offer error');
        }));
      }));
      return this._connectPromise;
    },
    initiateOffer: function(options) {
      var $__2 = this;
      options = options || {mandatory: {
          OfferToReceiveAudio: true,
          OfferToReceiveVideo: true
        }};
      return new Promise((function(resolve, reject) {
        $__2._connection.createOffer((function(offer) {
          return $__2._connection.setLocalDescription(offer, (function() {
            return resolve($__2._connection.localDescription);
          }), (function(error) {
            return reject('peer error set_local_description', $__2, error, offer);
          }));
        }), (function(error) {
          return reject(error);
        }), options);
      }));
    },
    receiveOffer: function(offer) {
      var $__2 = this;
      return new Promise((function(resolve, reject) {
        $__2._connection.setRemoteDescription(new RTCSessionDescription(offer), (function() {
          $__2._resolveIceCandidatePromises();
          $__2._connection.createAnswer((function(answer) {
            $__2._connection.setLocalDescription(answer, (function() {
              return resolve($__2._connection.localDescription);
            }), (function(error) {
              return reject('peer error set_local_description', $__2, error, answer);
            }));
          }), (function(error) {
            return reject('peer error send answer', $__2, error, offer);
          }));
        }), (function(error) {
          return reject('peer error set_remote_description', $__2, error, offer);
        }));
      }));
    },
    receiveAnswer: function(answer) {
      var $__2 = this;
      return new Promise((function(resolve, reject) {
        return $__2._connection.setRemoteDescription(new RTCSessionDescription(answer), (function() {
          $__2._resolveIceCandidatePromises();
          resolve();
        }), reject);
      }));
    },
    addIceCandidates: function(candidates) {
      var $__2 = this;
      return new Promise((function(outerResolve, outerReject) {
        _.each(candidates, (function(candidate) {
          $__2._iceCandidatePromises.push((function() {
            return new Promise((function(resolve, reject) {
              $__2._connection.addIceCandidate(new RTCIceCandidate(candidate), (function() {
                $__2._remoteCandidates.push(candidate);
                resolve();
              }), (function(error) {
                reject(error);
              }));
            }));
          }));
        }));
        $__2._resolveIceCandidatePromises(outerResolve, outerReject);
      }));
    },
    addChannel: function(label, options, channelHandler) {
      label = label || ('data-channel-' + this._nextChannelID++);
      var channel = this._addChannel(this._connection.createDataChannel(label, options), channelHandler);
      return channel;
    },
    removeChannel: function(label) {
      var channel = this._channels[label];
      if (channel) {
        delete this._channels[label];
        this.fire('channel removed', channel);
      }
    },
    addLocalStream: function(stream) {
      var localStream = new Stream(this, stream);
      this._localStreams.push(localStream);
      this._addLocalStream(stream);
      return localStream;
    },
    removeStream: function(stream) {
      var index = this._localStreams.indexOf(stream);
      if (index != 1) {
        this._localStreams.splice(index, 1);
        this._connection.removeStream(stream.stream);
      }
    },
    forwardStream: function(stream) {
      this._localStreams.push(stream);
      this._addLocalStream(stream.stream);
    },
    close: function() {
      if (this._connection && this._connection.iceConnectionState != 'closed')
        this._connection.close();
    },
    getStats: function() {
      var $__2 = this;
      return new Promise((function(resolve, reject) {
        $__2._connection.getStats(resolve, reject);
      }));
    },
    get id() {
      return this._id;
    },
    get config() {
      return this._config;
    },
    get localStreams() {
      return this._localStreams;
    },
    get remoteStreams() {
      return this._remoteStreams;
    },
    get channels() {
      return this._channels;
    },
    get isConnectingPeer() {
      return this._isConnectingPeer;
    },
    get log() {
      return this._log;
    },
    channel: function(label) {
      var $__2 = this;
      var promises = this._channelPromises = this._channelPromises || {};
      var promise = promises[label] = promises[label] || new Promise((function(resolve, reject) {
        var channel = $__2._channels[label];
        if (channel)
          resolve(channel);
        else {
          var listener = (function(channel) {
            if (channel.label == label) {
              $__2.off('channel add', listener);
              resolve(channel);
            }
          });
          $__2.on('channel add', listener);
        }
      }));
      return promise;
    },
    stream: function(id) {
      return _.find(this._remoteStreams, {'id': id});
    },
    get connection() {
      return this._connection;
    },
    _addChannel: function(channel) {
      var $__2 = this;
      channel = new Channel(this, channel);
      channel.on({'close': (function() {
          return $__2.removeChannel(channel.label);
        })});
      this._channels[channel.label] = channel;
      this.fire('channel add', channel);
      return channel;
    },
    _addLocalStream: function(stream) {
      var $__2 = this;
      this._connection.addStream(stream);
      console.log('_adding local stream');
      if (this._connected) {
        this.initiateOffer().then((function(offer) {
          return $__2.fire('offer ready', offer);
        })).catch((function(error) {
          console.log(error);
          $__2.fire('offer error');
        }));
      }
      this.fire('localStream add', stream);
      return stream;
    },
    _addRemoteStream: function(stream) {
      console.log('add remote stream');
      stream = new Stream(this, stream);
      this._remoteStreams.push(stream);
      this.fire('remoteStream add', stream);
      return stream;
    },
    _resolveIceCandidatePromises: function(resolve, reject) {
      if (this._connection.signalingState != 'have-local-offer' && this._connection.remoteDescription) {
        Promise.all(_.map(this._iceCandidatePromises, (function(fn) {
          return fn();
        }))).then((function() {
          return resolve();
        })).catch(reject);
        this._iceCandidatePromises.splice(0);
      }
    },
    _log: function() {
      this._log.push({
        at: new Date(),
        args: $traceurRuntime.spread(arguments)
      });
    }
  }, {});
}());
Object.defineProperties(module.exports, {
  Peer: {get: function() {
      return Peer;
    }},
  __esModule: {value: true}
});

//# sourceMappingURL=peer.js.map