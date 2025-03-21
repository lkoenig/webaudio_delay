
export class Plot {
    constructor(canvas) {
        this.canvas = canvas;
        this.canvas.width = 800;
        this.canvas.height = 600;
        this.context = this.canvas.getContext("2d");
        this.max_time = 0;
        this.pixelSize = 2e-3;
    }

    getLine(data) {
        const this_line = new Path2D();
        this_line.moveTo(0, data[0]);
        for (let n = 1; n < data.length; n++) {
            this_line.lineTo(n, data[n]);
        }
        return this_line;
    }

    plot(data) {
        console.log(`Plot ${data.length} points`);
        this.max_time = Math.max(this.max_time, data.length);
        const this_line = this.getLine(data);

        if (this.context !== null) {
            this.context.translate(0, this.canvas.height / 2);
            this.context.scale(this.canvas.width / this.max_time, this.canvas.height / 2);
            this.context.strokeStyle = 'orange';
            this.context.lineWidth = 1;
            this.context.stroke(this_line);
        }
    }

    drawCenterLine() {
        this.context.strokeStyle = '#263238';
        this.context.beginPath();
        this.context.moveTo(0, this.canvas.height / 2);
        this.context.lineTo(this.canvas.width, this.canvas.height / 2);
        this.context.stroke();
    }



    vLine(time, color = "#263238") {
        const x = Math.trunc(time / this.pixelSize);

        this.context.strokeStyle = color;
        this.context.beginPath();
        this.context.moveTo(x, 0);
        this.context.lineTo(x, this.canvas.height);
        this.context.stroke();

    }

    draw(data, sampleRate) {
        console.log("Drawing");
        const pixelSamples = Math.trunc(this.pixelSize * sampleRate);
        this.context.fillStyle = "red";
        for (let x = 0; x < this.canvas.width && (x + 1) * pixelSamples < data.length; ++x) {
            const amplitude = data.slice(x * pixelSamples, (x + 1) * pixelSamples)
                .reduce((accumulator, sample) => {
                    return {
                        min: Math.min(accumulator.min, sample),
                        max: Math.max(accumulator.max, sample),
                    }
                }, {
                    min: Infinity,
                    max: -Infinity
                });
            this.context.fillRect(x, this.canvas.height * (0.5 + amplitude.min), 1, (amplitude.max - amplitude.min) * this.canvas.height);
        }
        this.drawCenterLine();
    }
}