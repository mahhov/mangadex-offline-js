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
		let nextStream = new Stream();
		let cancel = () => this.listeners = this.listeners.filter(l => l !== listener);
		let listener = value => nextStream.add(handler(value, cancel));
		this.listeners.push(listener);
		if (this.hasValue)
			listener(this.value);
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
