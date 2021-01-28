class Stream {
	constructor(initializer = undefined, ...initialValues ) {
		this.hasValues = initialValues.length;
		this.values = initialValues;
		this.listeners = [];
		initializer?.(this.add.bind(this));
	}

	add(...values) {
		this.hasValues = true;
		this.values = values;
		this.listeners.forEach(listener => listener(...values));
	}

	on(listener) {
		if (this.hasValues)
			listener(...this.values);
		this.listeners.push(listener);
	}

	static mix(...streams) {
		let mixStream = new Stream();
		let sharedListener = _ => mixStream.add(...streams.map(stream => stream.values));
		streams.forEach(stream => stream.on(sharedListener));
		return mixStream;
	}
}

module.exports = Stream;
