let sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class Debounce {
	constructor(handler, delay) {
		let pending = false;
		return async (...params) => {
			if (pending) return;
			pending = true;
			handler(...params);
			await sleep(delay);
			pending = false;
		}
	}
}

module.exports = Debounce;
