"use strict";
var $__peer__;
var Peer = ($__peer__ = require("./peer"), $__peer__ && $__peer__.__esModule && $__peer__ || {default: $__peer__}).Peer;
var _ = require('lodash'),
    io = require('socket.io');
module.exports = (function(log, emitter, signaler) {
  if (!log)
    log = require('../log');
  if (!emitter)
    emitter = require('../emitter')();
  if (!signaler)
    signaler = require('./signaler')();
  var signal;
  var $__2 = emitter(),
      fire = $__2.emit,
      on = $__2.on,
      off = $__2.off;
  return (function(server) {
    if (signal === undefined)
      signal = connectToSignal(server);
    if (signal.ready)
      setTimeout((function() {
        return fire('ready', signal.myID);
      }), 0);
    return signal;
  });
  function connectToSignal(server) {
    var signal = {
      on: on,
      off: off,
      joinRoom: joinRoom,
      leaveRoom: leaveRoom,
      leaveRooms: leaveRooms,
      adminRoom: adminRoom,
      currentRooms: {},
      close: close
    };
    var rooms = signal.currentRooms;
    var peers = [],
        peersHash = {};
    var signalerEmitter = emitter();
    var socket = io(server + '/signal');
    var emit = (function(event, data) {
      return socket.emit(event, data);
    });
    var socketSignaler = signaler({
      emit: (function(name, data) {
        return emit('peer ' + name, data);
      }),
      on: signalerEmitter.on
    });
    socket.on('error', (function() {
      var $__4;
      for (var args = [],
          $__1 = 0; $__1 < arguments.length; $__1++)
        args[$__1] = arguments[$__1];
      return ($__4 = log).error.apply($__4, $traceurRuntime.spread(['Failed to connect socket.io'], args));
    }));
    _.each({
      'connect': (function() {
        return log.info('Connected to server');
      }),
      'your_id': (function(myID) {
        return gotID(myID);
      }),
      'room': (function(data) {
        return updateRoom(data);
      }),
      'peer join': (function(data) {
        return socketSignaler.managePeer(newPeer(data.id));
      }),
      'peer leave': (function(data) {
        return socketSignaler.dropPeer(removePeerByID(data.id));
      }),
      'peer offer': (function(data) {
        return signalerEmitter.emit('offer', data);
      }),
      'peer answer': (function(data) {
        return signalerEmitter.emit('answer', data);
      }),
      'peer candidates': (function(data) {
        return signalerEmitter.emit('candidates', data);
      }),
      'broadcast ready': (function(data) {
        return fire('broadcast_ready', socketSignaler.managePeer(newPeer(data.broadcasterID)));
      }),
      'broadcast error': (function(data) {
        return fire('broadcast_error', data);
      }),
      'error': (function(error) {
        return log.error(error);
      })
    }, (function(handler, name) {
      return socket.on(name, function() {
        handler.apply(this, arguments);
        fire.apply((void 0), $traceurRuntime.spread([name], arguments));
      });
    }));
    function gotID(myID) {
      log('Got ID', myID);
      signal.myID = myID;
      signal.ready = true;
      fire('ready', myID);
    }
    function updateRoom(data) {
      var room = rooms[data.roomName] || {};
      _.extend(room, data);
      console.log('got room', room);
      if (room.broadcasterID)
        socketSignaler.managePeer(newPeer(room.broadcasterID, {isExistingPeer: true}));
      else
        _.each(data.peerIDs, (function(peerID) {
          return socketSignaler.managePeer(newPeer(peerID, {isExistingPeer: true}));
        }));
    }
    function newPeer(id, config) {
      config = config || {isExistingPeer: false};
      var peer = new Peer(id, config);
      peers.push(peer);
      peersHash[id] = peer;
      fire('peer add', peer);
      return peer;
    }
    function removePeerByID(id) {
      var peer = getPeer(id);
      if (peer) {
        peer.close();
        _.remove(peers, (function(peer) {
          return peer.id === id;
        }));
        delete peersHash[id];
        fire('peer remove', peer);
        return peer;
      }
    }
    function joinRoom(roomName) {
      rooms[roomName] = rooms[roomName] || {roomName: roomName};
      emit('room join', roomName);
      fire('room join', roomName);
    }
    function leaveRoom(roomName) {
      delete rooms[roomName];
      emit('room leave', roomName);
      fire('room leave', roomName);
    }
    function leaveRooms() {
      for (var i = rooms.length - 1; i >= 0; i--)
        leaveRoom(rooms[i]);
    }
    function adminRoom(roomName, command) {
      log('admining', roomName, command);
      emit('room admin', _.extend({roomName: roomName}, command));
    }
    function close() {
      socket.close();
      _.each(peers, (function(peer) {
        return peer.close();
      }));
      signal = undefined;
    }
    function getPeer(id) {
      return peersHash[id];
    }
    return signal;
  }
});

//# sourceMappingURL=rtc.js.map