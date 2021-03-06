function FrontMixer(controls, audioContext, file) {
	this.controls = controls;
	this.file = file;

	this.controls.playElement.addEventListener('click', this.onPlayElementClick.bind(this));
	this.controls.stopElement.addEventListener('click', this.onStopElementClick.bind(this));
	this.controls.volumeFaderElement.addEventListener('input', this.onVolumeFaderElementInput.bind(this));
	this.controls.distortionElement.addEventListener('input', this.onDistortionInput.bind(this));

	this.context = new FrontMixerContext(audioContext);

	this.equalizer = new Equalizer(this.context, this.controls);
	this.distortion = this.context.audioContext.createWaveShaper();

	this.equalizer.outputNode.connect(this.context.gainNode);
	this.context.gainNode.connect(this.distortion);
	this.distortion.connect(this.context.audioContext.destination);
}

FrontMixer.prototype = {
	onPlayElementClick: function (event) {
		event.preventDefault();

		this.playAudio();
	},

	onStopElementClick: function (event) {
		event.preventDefault();

		this.stopAudio();
	},

	onVolumeFaderElementInput: function () {
		this.adjustVolume(this.controls.volumeFaderElement.value / 100);
	},

	onDistortionInput: function() {
		this.adjustDistortion(this.controls.distortionElement);
	},

	loadAudio: function () {
		var request = new Request(this.file);

		return fetch(request).then(function (response) {
			return response.arrayBuffer();
		});
	},

	streamAudio: function () {
		var that = this;

		var client = new BinaryClient('ws://localhost:9000');
		client.on('stream', function (stream) {
			var arrayBuffer = new ArrayBuffer();

			stream.on('data', function(chunk) {
				arrayBuffer.push(chunk);
			});

			that.context.audioContext.decodeAudioData(arrayBuffer, function (buffer) {
				that.context.source.buffer = buffer;
				that.context.source.start(0);
			});

		});
	},

	playAudio: function () {
		var that = this;

		this.loadAudio().then(function (arrayBuffer) {
			that.context.audioContext.decodeAudioData(arrayBuffer, function (buffer) {
				that.context.source.buffer = buffer;
				that.context.source.start(0);
			});
		});
	},

	stopAudio: function () {
		if (this.context.source != null) {
			this.context.source.stop();
		}
	},

	adjustVolume: function (volumePercentage) {
		this.context.gainNode.gain.value = volumePercentage;
	},

	adjustDistortion: function (amount) {
		function makeDistortionCurve(amount) {
			var k = typeof amount === 'number' ? amount : 50,
				n_samples = 44100,
				curve = new Float32Array(n_samples),
				deg = Math.PI / 180,
				i = 0,
				x;
			for ( ; i < n_samples; ++i ) {
				x = i * 2 / n_samples - 1;
				curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
			}
			return curve;
		}

		this.distortion.curve = makeDistortionCurve(amount);
		this.distortion.oversample = '4x';
	}
};

function FrontMixerContext(audioContext) {
	this.audioContext = audioContext;
	this.gainNode = this.audioContext.createGain();
	this.source = this.audioContext.createBufferSource();
}