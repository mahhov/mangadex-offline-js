// class XPromise {
// 	constructor(resolve, reject) {
// 		let promise = new Promise(resolve, reject);
// 		promise.then(() => promise.success = true);
// 		promise.catch(() => promise.error = true);
// 		promise.finally(() => promise.done = true);
// 		return promise;
// 	}
// }

module.exports = XPromise;

class XPromise {
	constructor() {
		let resolve, reject;
		let promise = new Promise((res, rej) => {
			resolve = res;
			reject = rej;
		});
		promise.resolve = resolve;
		promise.reject = reject;
		promise.then(() => promise.success = true);
		promise.catch(() => promise.error = true);
		promise.done = false;
		promise.finally(() => promise.done = true);
		return promise;
	}
}

module.exports = XPromise;
