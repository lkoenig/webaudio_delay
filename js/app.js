'use strict'

import { ExponentialSineSweep } from './exponential_sine_sweep.js';
import { MeasurementAudioMessageType } from './measurement_audio.js';
import { Plot } from './plot.js';
import { getDataAsWav } from './wav_tools.js';

const SAMPLE_RATE_HZ = 48000.0;
const preDelay = 0.2;
const silenceThreshold = -60;

const gumUseCheckbox = document.getElementById('gum-use');
const gdmUseCheckbox = document.getElementById('gdm-use');
const resultsTable = document.getElementById('results-table');

const startElement = document.getElementById("measureButton");
const plotCanvas = document.getElementById("plotCanvas");
const measuredResult = document.getElementById("measuredResult");
const audioContextLatency = document.getElementById("audioContextLatency");


let audioContext;

const exponential_sine_sweep = new ExponentialSineSweep(20.0 / SAMPLE_RATE_HZ * 2.0 * Math.PI, 0.5 * 2.0 * Math.PI, 2 ** 18);

async function initializeAudio(onMeasurement) {
    audioContext = new AudioContext({
        latencyHint: "interactive"
    });

    if (audioContext.state === "suspended") {
        console.log("Resume audio context");
        await audioContext.resume();
        console.log(`audio context sample rate: ${audioContext.sampleRate}`);
    }
    await audioContext.audioWorklet.addModule('js/measurement_audio_worklet.js');

    let impulseResponseEstimatorInputIndex = 0;
    let impulseResponseEstimatorNumInputs = 0;
    if (gdmUseCheckbox.checked) {
        impulseResponseEstimatorNumInputs++;
    }
    if (gumUseCheckbox.checked) {
        impulseResponseEstimatorNumInputs++;
    }
    const impulseResponseEstimatorNode = new AudioWorkletNode(
        audioContext,
        'measurement-processor',
        {
            numberOfInputs: impulseResponseEstimatorNumInputs,
            processorOptions: {
                preDelay,
                excitationSignal: exponential_sine_sweep.sine_sweep
            }
        }
    );
    console.log('Connect stimulus to output of AudioContext');
    impulseResponseEstimatorNode.connect(audioContext.destination);

    const measurmentTimestamp = Date.now();
    const measurmentMetadata = [];

    let gdmInputStream;
    if (gdmUseCheckbox.checked) {
        console.log('Use getDisplayMedia');
        const gdmOptions = {
            video: true,
            audio: {
                echoCancellation: false,
                autoGainControl: false,
                noiseSuppression: false,
                suppressLocalAudioPlayback: false,
            },
            systemAudio: 'include',
            preferCurrentTab: false,
            selfBrowserSurface: 'include',
            surfaceSwitching: 'exclude',
            monitorTypeSurfaces: 'include',

        };
        gdmInputStream = await navigator.mediaDevices.getDisplayMedia(gdmOptions);
        const gdmNode = new MediaStreamAudioSourceNode(audioContext, { mediaStream: gdmInputStream });
        gdmNode.connect(impulseResponseEstimatorNode, 0, impulseResponseEstimatorInputIndex);
        impulseResponseEstimatorInputIndex++;
        measurmentMetadata.push({
            timestamp: measurmentTimestamp,
            label: "getDisplayMedia",
        });
    }

    let gumInputStream;
    if (gumUseCheckbox.checked) {
        console.log('Use getUserMedia');
        // Get user's microphone and connect it to the AudioContext.
        gumInputStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: { exact: false },
                autoGainControl: { exact: false },
                noiseSuppression: { exact: false },
                latency: 0
            }
        });

        const gumNode = new MediaStreamAudioSourceNode(audioContext, { mediaStream: gumInputStream });
        gumNode.connect(impulseResponseEstimatorNode, 0, impulseResponseEstimatorInputIndex);
        impulseResponseEstimatorInputIndex++;
        measurmentMetadata.push({
            timestamp: measurmentTimestamp,
            label: "getUserMedia",
        });
    }

    console.log("Register logger for the audio worklet");
    impulseResponseEstimatorNode.port.onmessage = (event) => {
        if (event.data.type === MeasurementAudioMessageType.LOG) {
            console.log("[Worklet]: " + event.data.message);
        } else if (event.data.type === MeasurementAudioMessageType.MEASUREMENT_DONE) {
            console.log("Measurement is done");
            if (gumInputStream !== undefined) {
                gumInputStream.getTracks().forEach(function (track) {
                    track.stop();
                });
            }
            if (gdmInputStream !== undefined) {
                gdmInputStream.getTracks().forEach(function (track) {
                    track.stop();
                });
            }
            audioContext.suspend();
            onMeasurement(event.data.measurement, audioContext.sampleRate, measurmentMetadata);
        }
    };

    console.log('Start measurement');
    impulseResponseEstimatorNode.port.postMessage({
        type: MeasurementAudioMessageType.START_MEASUREMENT,
    });
}


function startMeasurement(onMeasurement) {
    console.log("Start measurement");
    initializeAudio(onMeasurement);
}

const p = new Plot(plotCanvas);

function publishResult(result) {
    const resultRow = resultsTable.insertRow(-1)

    const timestampCell = resultRow.insertCell(-1);
    const ts = new Date(result.timestamp);
    timestampCell.appendChild(document.createTextNode(ts.toISOString()));

    const labelCell = resultRow.insertCell(-1);
    labelCell.appendChild(document.createTextNode(result.label));

    const latencyCell = resultRow.insertCell(-1);
    const gainCell = resultRow.insertCell(-1);

    gainCell.appendChild(document.createTextNode(`${(result.gain).toFixed(1)}`));
    if (result.gain < silenceThreshold) {
        latencyCell.appendChild(document.createTextNode("n/a"));
    } else {
        latencyCell.appendChild(document.createTextNode(`${(result.latency * 1000).toFixed(3)}`));
    }


    let measurementCell = resultRow.insertCell(-1);
    const measurementAnchor = document.createElement("a");
    measurementAnchor.appendChild(document.createTextNode("link"));
    measurementAnchor.href = result.measurementLink;
    measurementAnchor.setAttribute('download', 'measurement.wav');
    measurementCell.appendChild(measurementAnchor);


    let irCell = resultRow.insertCell(-1);
    const irAnchor = document.createElement("a");
    irAnchor.href = result.impulseResponseLink;
    irAnchor.setAttribute('download', 'impulse_response.wav');
    irAnchor.appendChild(document.createTextNode("link"));
    irCell.appendChild(irAnchor);
}

startElement.onclick = () => {
    startMeasurement((measurements, sampleRateHz, metadata) => {
        for (let i = 0; i < measurements.length; i++) {
            const measurement = measurements[i];
            exponential_sine_sweep.linear_response(measurement).then(ir => {
                const measurementBlob = new Blob([getDataAsWav(sampleRateHz, 1, measurement)], { type: "audio/wav" });
                const irBlob = new Blob([getDataAsWav(sampleRateHz, 1, ir)], { type: "audio/wav" });
                p.vLine(0.2, "#0f0");
                p.draw(ir, sampleRateHz);
                const max = ir.reduce((a, b) => Math.max(Math.abs(a), Math.abs(b)), 0);
                const gainDb = 20.0 * Math.log10(Math.abs(max));
                console.log(`Max impulse response: ${max.toFixed(4)} (${gainDb.toFixed(1)} dB)`);
                const index_max = ir.findLastIndex(x => Math.abs(x) > 0.99 * max);
                const delay = index_max / sampleRateHz - preDelay;
                console.log(`Delay: ${delay} seconds`);
                if (gainDb > silenceThreshold) {
                    p.vLine(delay + preDelay, "#00f");
                }
                publishResult({
                    timestamp: metadata[i].timestamp,
                    label: metadata[i].label,
                    latency: delay,
                    gain: gainDb,
                    impulseResponseLink: URL.createObjectURL(irBlob),
                    measurementLink: URL.createObjectURL(measurementBlob),
                });
            });
        }
        audioContextLatency.textContent = `AudioContext baseLatency: ${audioContext.baseLatency} outputLatency: ${audioContext.outputLatency}`;
    });
};
