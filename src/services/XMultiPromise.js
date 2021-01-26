class XMultiPromise {
	constructor(promise = undefined) {
		this.thens = [];
		this.catches = [];
		this.finalies = [];

		this.resolved = false;
		this.rejected = false;
		this.done = false;
		this.resolvedObj = null;
		this.rejectedObj = null;

		promise?.then(obj => this.resolve(obj));
		promise?.catch(obj => this.reject(obj));
	}

	then(handler) {
		let promise = new XMultiPromise();
		this.thens.push([handler, promise]);
		return promise;
	}

	catch(handler) {
		let nextPromise = new XMultiPromise();
		this.catches.push([handler, nextPromise]);
		return nextPromise;
	}

	finaly(handler) {
		let nextPromise = new XMultiPromise();
		this.finalies.push([handler, nextPromise]);
		return nextPromise;
	}

	resolve(obj, onlyIfFirst = false) {
		if (onlyIfFirst && this.done) return;
		this.resolved = true;
		this.rejected = false;
		this.done = true;
		this.resolvedObj = obj;
		this.invokeHandlers(this.thens, obj);
		this.invokeHandlers(this.finalies, obj);
	}

	reject(obj, onlyIfFirst = false) {
		if (onlyIfFirst && this.done) return;
		this.resolved = false;
		this.rejected = true;
		this.done = true;
		this.rejectedObj = obj;
		this.invokeHandlers(this.catches, obj);
		this.invokeHandlers(this.finalies, obj);
	}

	invokeHandlers(handlers, obj) {
		handlers.forEach(([handler, nextPromise]) =>
			nextPromise.resolve(handler(obj)));

	}
}

module.exports = XMultiPromise;
