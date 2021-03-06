const XPromise = require('./XPromise');

let sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class Task {
	constructor(handler, parentQueue, highPriority = false) {
		this.handler = handler;
		this.parentQueue = parentQueue;
		this.highPriority = highPriority;
		this.aborted = false; // todo
		this.promise = new XPromise();
	}

	setHighPriority() {
		this.highPriority = true;
		this.parentQueue.checkHighPriorityTasks_();
	}

	abort() {
		this.aborted = true;
	}
}

class RateLimitedRetryQueue {
	constructor(delay = 1000, retries = [1000, 2000, 6000], batchSize = 1, highPriorityImmediate = false) {
		this.delay = delay;
		this.retries = retries;
		this.batchSize = batchSize;
		this.highPriorityImmediate = highPriorityImmediate;
		this.lastTime = Date.now();
		this.queue = [];
		this.active = false;
	}

	add(handler, highPriority = false) {
		let task = new Task(handler, this, highPriority);
		this.queue.push(task);
		this.checkHighPriorityTasks_();
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
		if (this.active) return;
		this.active = true;
		while (this.queue.length) {
			let batch = this.queue
				.sort((a, b) => b.highPriority - a.highPriority)
				.splice(0, this.batchSize);
			await Promise.all(batch.map(task => this.next_(task)));
			await sleep(this.delay - Date.now() + this.lastTime);
		}
		this.active = false;
	}

	checkHighPriorityTasks_() {
		if (!this.highPriorityImmediate) return;
		this.queue.sort((a, b) => b.highPriority - a.highPriority);
		let count = this.queue.filter(a => a.highPriority).length
		let batch = this.queue.splice(0, count);
		batch.forEach(task => this.next_(task));
	}
}

module.exports = RateLimitedRetryQueue;
