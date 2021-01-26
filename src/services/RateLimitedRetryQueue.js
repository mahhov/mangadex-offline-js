const XPromise = require('./XPromise');

let sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class Task {
	constructor(handler, parentQueue) {
		this.handler = handler;
		this.parentQueue = parentQueue;
		this.aborted = false; // todo
		this.promise = new XPromise();
	}

	abort() {
		this.aborted = true;
	}

	moveToFront() {
		let i = this.parentQueue.indexOf(this);
		if (i === -1) return; // Occurs when the task has already been completed
		this.parentQueue.splice(i, 1);
		this.parentQueue.unshift(this);
	}
}

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
		let task = new Task(handler, this.queue);
		this.queue.push(task);
		this.activate_();
		return task;
	}

	addFront(handler) {
		let task = new Task(handler, this.queue);
		this.queue.unshift(task);
		this.activate_();
		return task;
	}

	async next_(task) {
		for (let retry of this.retries)
			try {
				this.lastTime = Date.now();
				return task.promise.resolve(await task.handler());
			} catch {
				await sleep(retry);
			}
		try {
			this.lastTime = Date.now();
			task.promise.resolve(await task.handler());
		} catch (e) {
			task.promise.reject(e);
		}
	}

	async activate_() {
		if (this.active)
			return;
		this.active = true;
		while (this.queue.length) {
			let batch = this.queue.splice(0, this.batchSize);
			await Promise.all(batch.map(task => this.next_(task)));
			await sleep(this.delay - Date.now() + this.lastTime);
		}
		this.active = false;
	}
}

module.exports = RateLimitedRetryQueue;
