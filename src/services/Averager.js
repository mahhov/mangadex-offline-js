class Averager {
	constructor() {
		this.values = [];
	}

	add(value) {
		this.values.push(value);
	}

	get average() {
		return this.values.reduce((a, b) => a + b) / this.values.length;
	}
}

module.exports = Averager;
