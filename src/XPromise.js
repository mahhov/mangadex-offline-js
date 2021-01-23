class XPromise {
	constructor(promise = undefined) {
		let resolve, reject;
		let xPromise = new Promise((res, rej) => {
			resolve = res;
			reject = rej;
		});
		xPromise.resolve = resolve;
		xPromise.reject = reject;

		xPromise.success = false;
		xPromise.error = false;
		xPromise.done = false;
		xPromise.then(() => xPromise.success = true);
		xPromise.catch(() => xPromise.error = true);
		xPromise.finally(() => xPromise.done = true);

		promise?.then(resolve);
		promise?.catch(reject);

		return xPromise;
	}
}

module.exports = XPromise;
