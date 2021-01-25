class XPromise {
	constructor(promise = undefined) {
		let resolve, reject;
		let xPromise = new Promise((res, rej) => {
			resolve = res;
			reject = rej;
		});

		xPromise.resolvedObj = null;
		xPromise.resolved = false;
		xPromise.rejectedObj = null;
		xPromise.rejected = false;
		xPromise.done = false;

		xPromise.resolve = obj => {
			xPromise.resolved = true;
			xPromise.resolvedObj = obj;
			xPromise.done = true;
			resolve(obj);
		};

		xPromise.reject = obj => {
			xPromise.rejected = true;
			xPromise.rejectedObj = obj;
			xPromise.done = true;
			reject(obj);
		};

		xPromise.xThen = handler =>
			new XPromise(xPromise.then(handler));
		xPromise.xCatch = handler =>
			new XPromise(xPromise.catch(handler));

		promise?.then(obj => xPromise.resolve(obj));
		promise?.catch(obj => xPromise.reject(obj));

		return xPromise;
	}
}

module.exports = XPromise;
