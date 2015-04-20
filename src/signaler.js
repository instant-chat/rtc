module.exports = emitter => {
  if (!emitter) emitter = require('es-emitter')(); // please, please, please get rid of this

  return transport => {
    var {emit, on, off} = emitter();

    var signaler = {
      peers: {},
      peerCount: 0,

      managePeer: managePeer,
      dropPeer: dropPeer,

      managesPeer: managesPeer
    };

    transport.on({
      'offer':      data => receiveOffer(data.peerID, data.offer),
      'answer':     data => receiveAnswer(data.peerID, data.answer),
      'candidates': data => receiveIceCandidates(data.peerID, data.candidates)
    });

    var {peers} = signaler;
    var {emit: send} = transport;

    function managePeer(peer) {
      var peerID = peer.id,
          candidates = [];

      peers[peerID] = peer;
      signaler.peerCount++;

      peer.on({
        'offer ready': offer => {
          console.log('offer ready');
          send('offer', {peerID, offer});
          emit('send offer', peer, offer);
        },

        ice_candidate: event => {
          var candidate = event.candidate;

          if (candidate) {
            candidates.push(candidate);
            sendIceCandidates();
            emit('ice_candidate', peer, candidate);
          }
        },
      });

      // Is this the best way to do this?
      var sendIceCandidates = _.throttle(() => {
        send('candidates', {peerID, candidates});
        candidates.splice(0);
      }, 0);

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
      peer
        .receiveOffer(offer)
        .then(
          answer => {
            send('answer', {peerID, answer});
            emit('send answer', peer, answer);
          },
          (...error) => emit('error offer', peer, answer, ...error));
    }

    function receiveAnswer(peerID, answer) {
      var peer = getPeer(peerID);

      emit('peer receive answer', peer, answer);
      peer
        .receiveAnswer(answer)
        .then(
          () =>       emit('accepted answer', peer, answer),
          (...error) => emit('error answer', peer, answer, ...error));
    }

    function receiveIceCandidates(peerID, candidates) {
      var peer = getPeer(peerID);

      emit('peer receive candidates', peer, candidates);
      peer
        .addIceCandidates(candidates)
        .then(
          () =>       emit('accepted candidates', peer, candidates),
          (...error) => emit('error candidates', peer, candidates, ...error));
    }

    function getPeer(id) {
      var peer = peers[id];

      if (peer) return peer;

      throw 'Tried to get non-existent peer!';
    }

    function managesPeer(id) {
      const peer = peers[id];
      return peer !== null && peer !== undefined;
    }

    return signaler;
  };
};