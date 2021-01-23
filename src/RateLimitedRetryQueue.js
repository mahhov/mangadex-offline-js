let sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class RateLimitedRetryQueue {
	constructor(delay = 1000, retries = [1000, 2000, 6000], batchSize = 1) {
		this.delay = delay;
		this.retries = retries;
		this.batchSize = batchSize;
		this.lastTime = Date.now();
		this.queue = [];
		this.batch = [];
		this.active = false;
	}

	add(handler) {
		return new Promise((resolve, reject) => {
			this.queue.push([handler, resolve, reject]);
			this.activate_();
		});
	}

	async next_(handler, resolve, reject) {
		for (let retry of this.retries)
			try {
				this.lastTime = Date.now();
				return resolve(await handler());
			} catch {
				await sleep(retry);
			}
		try {
			this.lastTime = Date.now();
			resolve(await handler());
		} catch (e) {
			reject(e);
		}
	}

	async activate_() {
		if (this.active)
			return;
		this.active = true;
		while (this.queue.length) {
			let batch = this.queue.splice(0, this.batchSize);
			await Promise.all(batch.map(b => this.next_(...b)));
			await sleep(this.delay - Date.now() + this.lastTime);
		}
		this.active = false;
	}
}

module.exports = RateLimitedRetryQueue;
