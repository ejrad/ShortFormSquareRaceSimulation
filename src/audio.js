let audioCtx = null;
let noteIndex = 0;
let mediaDest = null; // for capturing audio stream

// Gravity Falls Theme - exact notes from piano tutorial
const GRAVITY_FALLS_NOTES = [
    // Arpeggios
    349.23, 293.66, 220.00, 293.66, 349.23, 293.66, 220.00, 293.66, // F D A D F D A D
    349.23, 261.63, 220.00, 261.63, 349.23, 261.63, 220.00, 261.63, // F C A C F C A C
    329.63, 277.18, 220.00, 277.18, 329.63, 277.18, 220.00, 277.18, // E C# A C# E C# A C#
    329.63, 277.18, 220.00, 277.18, 329.63,                          // E C# A C# E

    // Melody
    440.00, 293.66, 329.63, 349.23, 440.00, 392.00, 440.00, 523.25, // A D E F A G A C
    587.33, 659.25, 698.46, 659.25, 783.99, 880.00, 783.99, 698.46, // D E F E G A G F
    698.46, 698.46, 698.46, 880.00, 880.00, 783.99, 698.46,          // F F F A A G F
    880.00, 880.00, 880.00, 783.99, 880.00, 783.99, 698.46,          // A A A G A G F
    698.46, 698.46, 698.46, 880.00, 880.00, 783.99, 698.46,          // F F F A A G F
    880.00, 880.00, 880.00, 554.37, 554.37, 554.37,                  // A A A C# C# C#
    698.46, 698.46, 698.46, 880.00, 880.00, 783.99, 698.46,          // F F F A A G F
    932.33, 932.33, 932.33, 783.99, 523.25, 880.00, 554.37,          // A# A# A# G C A C#
    587.33,                                                           // D
];

export function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        mediaDest = audioCtx.createMediaStreamDestination();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

export function getAudioStream() {
    return mediaDest ? mediaDest.stream : null;
}

export function playNextMelodyNote(volume = 0.25) {
    initAudio();
    if (!audioCtx) return;

    // Advance note index strictly in order
    const freq = GRAVITY_FALLS_NOTES[noteIndex % GRAVITY_FALLS_NOTES.length];
    noteIndex++;

    const now = audioCtx.currentTime;

    // Master Piano ADSR Gain
    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(volume, now + 0.005);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    // Warm Piano Lowpass Filter (fixed high cutoff so it doesn't alter perceived pitch)
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(5000, now);

    // Fundamental Sine wave
    const osc1 = audioCtx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);

    // Subtle Octave Harmonic
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, now);
    gain2.gain.setValueAtTime(0.05, now);

    osc1.connect(masterGain);
    osc2.connect(gain2);
    gain2.connect(masterGain);

    masterGain.connect(filter);
    filter.connect(audioCtx.destination);
    // Also route audio to recording stream
    if (mediaDest) filter.connect(mediaDest);

    osc1.start(now);
    osc2.start(now);

    osc1.stop(now + 0.5);
    osc2.stop(now + 0.5);
}

export function playBreakSound() {
    initAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    // Short percussive click using a noise buffer
    const bufferSize = audioCtx.sampleRate * 0.05; // 50ms
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        // White noise
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2); // fade out
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    noise.connect(gain);
    gain.connect(audioCtx.destination);
    // Also route to recording stream
    if (mediaDest) gain.connect(mediaDest);
    noise.start(now);
    noise.stop(now + 0.05);
}

