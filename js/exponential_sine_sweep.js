
async function convolve_webaudio(a, b) {
    const sampleRate = 48000;
    let ctx = new OfflineAudioContext({ numberOfChannels: 1, length: a.length + b.length - 1, sampleRate });
    let x = new AudioBuffer({ length: a.length, numberOfChannels: 1, sampleRate });
    x.copyToChannel(a, 0);
    let h = new AudioBuffer({ length: b.length, numberOfChannels: 1, sampleRate });
    h.copyToChannel(b, 0);
    let x_node = new AudioBufferSourceNode(ctx, { buffer: x });
    let convolver = new ConvolverNode(ctx, { normalize: false, buffer: h });
    x_node.connect(convolver);
    convolver.connect(ctx.destination);
    await x_node.start();
    let y = await ctx.startRendering();
    return y.getChannelData(0);
}

export class ExponentialSineSweep {
    constructor(start_pulsation, stop_pulsation, length, gain = 0.25) {
        this.sine_sweep = new Float32Array(length);
        this.analysis = new Float32Array(length);
        this.analysis.fill(1.0);
        let exponential_rate = Math.log(stop_pulsation / start_pulsation);
        let phi = start_pulsation / exponential_rate * this.sine_sweep.length;
        let analyis_power = 0.0;

        for (let i = 0; i < this.sine_sweep.length; i++) {
            let e = Math.exp(exponential_rate *
                (i / length));
            let phase = phi * (e - 1.0);
            const s = gain * Math.sin(phase);
            this.sine_sweep[i] = s
            analyis_power += s * s / e;
            this.analysis[i] *= 1.0 / e;
            this.analysis[this.analysis.length - 1 - i] *= s;
        }
        for (let i = 0; i < this.analysis.length; ++i) {
            this.analysis[i] = this.analysis[i] / analyis_power;
        }
    }

    async linear_response(measurement) {
        const impulse_response = await convolve_webaudio(measurement, this.analysis);
        const linear_impulse_response = impulse_response.slice(this.analysis.length - 1);
        return linear_impulse_response;
    }
};

