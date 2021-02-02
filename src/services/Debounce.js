let sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class Debounce {
	constructor(handler, delay) {
		let pending = false;
		return async (...params) => {
			if (pending) return;
			pending = true;
			await sleep(delay);
			handler(...params);
			pending = false;
		}
	}
}

module.exports = Debounce;
