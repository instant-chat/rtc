// Coordinates your peers. Sets up connections, streams, and channels.
// Based on webrtc.io

import {Peer} from './peer';

var _ = require('lodash'),
    io = require('socket.io');

module.exports = (log, emitter, signaler) => {
  if (!log) log = require('../log');
  if (!emitter) emitter = require('../emitter')();
  if (!signaler) signaler = require('./signaler')();

  var signal;

  var {emit: fire, on, off} = emitter();

  return server => {
    if (signal === undefined) signal = connectToSignal(server);

    if (signal.ready) setTimeout(() => fire('ready', signal.myID), 0); // oof, get me (this line of code) out of here

    return signal;
  };

  /*
  +  Signalling
  */
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

    var {currentRooms: rooms} = signal;

    var peers = [],
        peersHash = {};

    var signalerEmitter = emitter();

    var socket = io(server + '/signal');

    var emit = (event, data) => socket.emit(event, data);
    var socketSignaler = signaler({
        emit: (name, data) => emit('peer ' + name, data),
        on: signalerEmitter.on
      });

    socket.on('error', (...args) => log.error('Failed to connect socket.io', ...args));

    // These are the messages we receive from the signal and their handlers
    _.each({
      'connect':      () => log.info('Connected to server'),
      'your_id':    myID => gotID(myID),

      'room':       data => updateRoom(data),

      'peer join':  data => socketSignaler.managePeer(newPeer(data.id)),
      'peer leave': data => socketSignaler.dropPeer(removePeerByID(data.id)), // What happens if id is non-existent?

      'peer offer':      data => signalerEmitter.emit('offer', data),
      'peer answer':     data => signalerEmitter.emit('answer', data),
      'peer candidates': data => signalerEmitter.emit('candidates', data),

      'broadcast ready': data => fire('broadcast_ready', socketSignaler.managePeer(newPeer(data.broadcasterID))), // think of better event names for this?
      'broadcast error': data => fire('broadcast_error', data),

      'error': error => log.error(error)
    }, (handler, name) => socket.on(name, function() {
      handler.apply(this, arguments);
      fire(name, ...arguments); //broadcast ready and broadcast error will fire twice!
    }));

    function gotID(myID) {
      log('Got ID', myID);

      signal.myID = myID;

      signal.ready = true;
      fire('ready', myID);
    }

    function updateRoom(data) {
      var room = rooms[data.roomName] || {};
      _.extend(room, data); // can do better than this!
      console.log('got room', room);
      if (room.broadcasterID) socketSignaler.managePeer(newPeer(room.broadcasterID, {isExistingPeer: true}));
      else _.each(data.peerIDs, peerID => socketSignaler.managePeer(newPeer(peerID, {isExistingPeer: true})));
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
        _.remove(peers, peer => { return peer.id === id; });
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
      for (var i = rooms.length -1; i >= 0; i--) leaveRoom(rooms[i]);
    }

    function adminRoom(roomName, command) {
      log('admining', roomName, command);
      emit('room admin', _.extend({roomName}, command));
      //Should we check for responses or something?
    }

    function close() {
      socket.close();
      _.each(peers, peer => peer.close());
      signal = undefined;
    }

    function getPeer(id) {
      return peersHash[id];
    }

    return signal;
  }
  /*
  -  Signalling
  */
};