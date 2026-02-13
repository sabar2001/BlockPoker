import { socketService } from './socketService';

interface PeerConnection {
  pc: RTCPeerConnection;
  remoteStream: MediaStream;
  gainNode: GainNode;
  pannerNode: StereoPannerNode;
  sourceNode: MediaStreamAudioSourceNode | null;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const MAX_HEAR_DISTANCE = 15; // units in 3D space

class VoiceService {
  private audioContext: AudioContext | null = null;
  private localStream: MediaStream | null = null;
  private peers: Map<string, PeerConnection> = new Map();
  private isMuted: boolean = false;
  private pushToTalk: boolean = false;
  private pttActive: boolean = false;

  // Player positions and look directions for spatial audio (updated externally)
  private myPosition: [number, number, number] = [0, 0, 0];
  private myForward: [number, number, number] = [0, 0, -1];
  private peerPositions: Map<string, [number, number, number]> = new Map();

  async init(): Promise<void> {
    // Check browser compatibility
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('[VoiceService] getUserMedia not supported in this browser');
      throw new Error('Microphone not supported');
    }

    this.audioContext = new AudioContext();

    // Handle AudioContext suspended state (common on mobile browsers)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      console.log('[VoiceService] AudioContext resumed from suspended state');
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      const error = err as Error;
      console.error('[VoiceService] Microphone access failed:', error.message);
      throw error; // Re-throw so caller knows initialization failed
    }

    // Set up signaling listeners
    socketService.on('voice:offer', async (data: { from: string; sdp: RTCSessionDescriptionInit }) => {
      await this.handleOffer(data.from, data.sdp);
    });

    socketService.on('voice:answer', async (data: { from: string; sdp: RTCSessionDescriptionInit }) => {
      const peer = this.peers.get(data.from);
      if (peer) await peer.pc.setRemoteDescription(data.sdp);
    });

    socketService.on('voice:ice-candidate', async (data: { from: string; candidate: RTCIceCandidateInit }) => {
      const peer = this.peers.get(data.from);
      if (peer) await peer.pc.addIceCandidate(data.candidate);
    });

    // PTT key listener
    window.addEventListener('keydown', (e) => {
      if (e.key === 'v' || e.key === 'V') {
        if (this.pushToTalk && !this.pttActive) {
          this.pttActive = true;
          this.updateMuteState();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'v' || e.key === 'V') {
        if (this.pushToTalk) {
          this.pttActive = false;
          this.updateMuteState();
        }
      }
    });

    console.log('[Voice] Initialized');
  }

  // Called when a new player joins the room — initiate a peer connection
  async connectToPeer(peerId: string): Promise<void> {
    if (this.peers.has(peerId) || !this.audioContext) return;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    const remoteStream = new MediaStream();

    // Create audio nodes for proximity/directional processing
    const gainNode = this.audioContext.createGain();
    const pannerNode = this.audioContext.createStereoPanner();
    gainNode.connect(pannerNode);
    pannerNode.connect(this.audioContext.destination);

    const peerConn: PeerConnection = { pc, remoteStream, gainNode, pannerNode, sourceNode: null };
    this.peers.set(peerId, peerConn);

    // Add local tracks
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      remoteStream.addTrack(event.track);

      // Connect remote stream to audio pipeline
      if (!peerConn.sourceNode && this.audioContext) {
        peerConn.sourceNode = this.audioContext.createMediaStreamSource(remoteStream);
        peerConn.sourceNode.connect(gainNode);
      }
    };

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.sendIceCandidate(peerId, event.candidate.toJSON());
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.disconnectPeer(peerId);
      }
    };

    // Create and send offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketService.sendVoiceOffer(peerId, offer);
  }

  private async handleOffer(fromId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.audioContext) return;

    // Create peer connection if it doesn't exist
    if (!this.peers.has(fromId)) {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      const remoteStream = new MediaStream();
      const gainNode = this.audioContext.createGain();
      const pannerNode = this.audioContext.createStereoPanner();
      gainNode.connect(pannerNode);
      pannerNode.connect(this.audioContext.destination);

      const peerConn: PeerConnection = { pc, remoteStream, gainNode, pannerNode, sourceNode: null };
      this.peers.set(fromId, peerConn);

      if (this.localStream) {
        for (const track of this.localStream.getTracks()) {
          pc.addTrack(track, this.localStream);
        }
      }

      pc.ontrack = (event) => {
        remoteStream.addTrack(event.track);
        if (!peerConn.sourceNode && this.audioContext) {
          peerConn.sourceNode = this.audioContext.createMediaStreamSource(remoteStream);
          peerConn.sourceNode.connect(gainNode);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketService.sendIceCandidate(fromId, event.candidate.toJSON());
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          this.disconnectPeer(fromId);
        }
      };
    }

    const peer = this.peers.get(fromId)!;
    await peer.pc.setRemoteDescription(sdp);
    const answer = await peer.pc.createAnswer();
    await peer.pc.setLocalDescription(answer);
    socketService.sendVoiceAnswer(fromId, answer);
  }

  disconnectPeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    peer.sourceNode?.disconnect();
    peer.gainNode.disconnect();
    peer.pannerNode.disconnect();
    peer.pc.close();
    this.peers.delete(peerId);
  }

  // --- Spatial Audio Update (call every frame from the 3D scene) ---
  updateSpatialAudio(
    myPos: [number, number, number],
    myFwd: [number, number, number],
    peerPositions: Map<string, [number, number, number]>
  ): void {
    this.myPosition = myPos;
    this.myForward = myFwd;
    this.peerPositions = peerPositions;

    for (const [peerId, peer] of this.peers) {
      const peerPos = this.peerPositions.get(peerId);
      if (!peerPos) continue;

      // Distance attenuation
      const dx = peerPos[0] - this.myPosition[0];
      const dy = peerPos[1] - this.myPosition[1];
      const dz = peerPos[2] - this.myPosition[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const distGain = Math.max(0, 1 - dist / MAX_HEAR_DISTANCE);

      // Directionality: dot product of my forward direction and direction to peer
      const dirLen = Math.sqrt(dx * dx + dz * dz) || 1;
      const dirX = dx / dirLen;
      const dirZ = dz / dirLen;
      const fwdLen = Math.sqrt(this.myForward[0] ** 2 + this.myForward[2] ** 2) || 1;
      const fwdX = this.myForward[0] / fwdLen;
      const fwdZ = this.myForward[2] / fwdLen;

      const dot = fwdX * dirX + fwdZ * dirZ; // -1 to 1
      // When facing toward them (dot=1) full volume; facing away (dot=-1) reduced
      const dirMultiplier = 0.3 + 0.7 * ((dot + 1) / 2);

      peer.gainNode.gain.setTargetAtTime(distGain * dirMultiplier, this.audioContext!.currentTime, 0.05);

      // Stereo panning: cross product gives left/right
      const cross = fwdX * dirZ - fwdZ * dirX; // positive = right, negative = left
      const pan = Math.max(-1, Math.min(1, cross));
      peer.pannerNode.pan.setTargetAtTime(pan, this.audioContext!.currentTime, 0.05);
    }
  }

  // --- Controls ---
  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.updateMuteState();
    return this.isMuted;
  }

  setPushToTalk(enabled: boolean): void {
    this.pushToTalk = enabled;
    this.pttActive = false;
    this.updateMuteState();
  }

  private updateMuteState(): void {
    if (!this.localStream) return;
    const shouldMute = this.isMuted || (this.pushToTalk && !this.pttActive);
    for (const track of this.localStream.getAudioTracks()) {
      track.enabled = !shouldMute;
    }

    // Broadcast speaking state
    socketService.sendSpeaking(!shouldMute);
  }

  get isActive(): boolean {
    return !!this.localStream && this.localStream.getAudioTracks().length > 0;
  }

  get muted(): boolean {
    return this.isMuted;
  }

  destroy(): void {
    for (const [id] of this.peers) {
      this.disconnectPeer(id);
    }
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;
    this.audioContext?.close();
    this.audioContext = null;
  }
}

export const voiceService = new VoiceService();
