class Stream {
	constructor(initializer = undefined, initialValue = undefined) {
		this.hasValue = initialValue !== undefined;
		this.value = initialValue;
		this.listeners = [];
		initializer?.(this.add.bind(this));
	}

	add(value) {
		this.hasValue = true;
		this.value = value;
		this.listeners.forEach(listener => listener(value));
	}

	on(handler) {
		let nextStream = new Stream(add =>
			this.listeners.push(value => add(handler(value))));
		if (this.hasValue)
			nextStream.add(handler(this.value));
		return nextStream;
	}

	get promise() {
		return new Promise(resolve => this.on(resolve));
	}

	static mix(...streams) {
		let mixStream = new Stream();
		let sharedListener = _ => mixStream.add(streams.map(stream => stream.value));
		streams.forEach(stream => stream.on(sharedListener));
		return mixStream;
	}
}

module.exports = Stream;
