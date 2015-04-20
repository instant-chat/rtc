"use strict";
module.exports = (function(emitter) {
  if (!emitter)
    emitter = require('es-emitter')();
  return (function(transport) {
    var $__1 = emitter(),
        emit = $__1.emit,
        on = $__1.on,
        off = $__1.off;
    var signaler = {
      peers: {},
      peerCount: 0,
      managePeer: managePeer,
      dropPeer: dropPeer,
      managesPeer: managesPeer
    };
    transport.on({
      'offer': (function(data) {
        return receiveOffer(data.peerID, data.offer);
      }),
      'answer': (function(data) {
        return receiveAnswer(data.peerID, data.answer);
      }),
      'candidates': (function(data) {
        return receiveIceCandidates(data.peerID, data.candidates);
      })
    });
    var peers = signaler.peers;
    var send = transport.emit;
    function managePeer(peer) {
      var peerID = peer.id,
          candidates = [];
      peers[peerID] = peer;
      signaler.peerCount++;
      peer.on({
        'offer ready': (function(offer) {
          console.log('offer ready');
          send('offer', {
            peerID: peerID,
            offer: offer
          });
          emit('send offer', peer, offer);
        }),
        ice_candidate: (function(event) {
          var candidate = event.candidate;
          if (candidate) {
            candidates.push(candidate);
            sendIceCandidates();
            emit('ice_candidate', peer, candidate);
          }
        })
      });
      var sendIceCandidates = _.throttle((function() {
        send('candidates', {
          peerID: peerID,
          candidates: candidates
        });
        candidates.splice(0);
      }), 0);
      return peer;
    }
    function dropPeer(peer) {
      var storedPeer = peers[peer.id];
      if (storedPeer) {
        storedPeer.off();
        delete peers[peer.id];
        signaler.peerCount--;
      }
      return peer;
    }
    function receiveOffer(peerID, offer) {
      var peer = getPeer(peerID);
      emit('peer receive offer', peer, offer);
      peer.receiveOffer(offer).then((function(answer) {
        send('answer', {
          peerID: peerID,
          answer: answer
        });
        emit('send answer', peer, answer);
      }), (function() {
        for (var error = [],
            $__0 = 0; $__0 < arguments.length; $__0++)
          error[$__0] = arguments[$__0];
        return emit.apply((void 0), $traceurRuntime.spread(['error offer', peer, answer], error));
      }));
    }
    function receiveAnswer(peerID, answer) {
      var peer = getPeer(peerID);
      emit('peer receive answer', peer, answer);
      peer.receiveAnswer(answer).then((function() {
        return emit('accepted answer', peer, answer);
      }), (function() {
        for (var error = [],
            $__0 = 0; $__0 < arguments.length; $__0++)
          error[$__0] = arguments[$__0];
        return emit.apply((void 0), $traceurRuntime.spread(['error answer', peer, answer], error));
      }));
    }
    function receiveIceCandidates(peerID, candidates) {
      var peer = getPeer(peerID);
      emit('peer receive candidates', peer, candidates);
      peer.addIceCandidates(candidates).then((function() {
        return emit('accepted candidates', peer, candidates);
      }), (function() {
        for (var error = [],
            $__0 = 0; $__0 < arguments.length; $__0++)
          error[$__0] = arguments[$__0];
        return emit.apply((void 0), $traceurRuntime.spread(['error candidates', peer, candidates], error));
      }));
    }
    function getPeer(id) {
      var peer = peers[id];
      if (peer)
        return peer;
      throw 'Tried to get non-existent peer!';
    }
    function managesPeer(id) {
      var peer = peers[id];
      return peer !== null && peer !== undefined;
    }
    return signaler;
  });
});

//# sourceMappingURL=signaler.js.map