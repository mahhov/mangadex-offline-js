const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const RateLimitedRetryQueue = require('./RateLimitedRetryQueue');
const XPromise = require('./XPromise');
const XMultiPromise = require('./XMultiPromise');

let getQueueChapters = new RateLimitedRetryQueue(10, undefined, 10);
let getQueuePages = new RateLimitedRetryQueue(10, undefined, 10);
let get = (endpoint, abortObj = {}, options = undefined, queue = getQueueChapters, highPriority = false) => {
	let handler = () =>
		abortObj.aborted ?
			Promise.resolve(null) :
			axios.get(endpoint, options).then(response =>
				abortObj.aborted ? null : response.data);
	return highPriority ? queue.addFront(handler) : queue.add(handler);
};

let sortNames = (name1, name2) => {
	let [nums1, nums2] = [name1, name2].map(name =>
		name.split(/[^\d]+/).map(s => Number(s)));
	for (let i = 0; i < Math.min(nums1.length, nums2.length); i++)
		if (nums1[i] !== nums2[i])
			return nums1[i] - nums2[i];
	return nums1.length - nums2.length;
};

let writeQueue = new RateLimitedRetryQueue(100, undefined, 10);
let write = async (writePath, data) => {
	await fs.mkdir(path.dirname(await writePath), {recursive: true});
	return writeQueue.add(() => fs.writeFile(writePath, data)).promise;
}

let readDir = async (readPath, dirs = false) =>
	(await fs.readdir(readPath, {withFileTypes: true}))
		.filter(entry => dirs ? entry.isDirectory() : entry.isFile())
		.map(entry => entry.name)
		.sort(sortNames);

class Manga {
	constructor(id, language, mangaTitle, parentDir) {
		this.id = id;
		this.language = language;
		// mangaTitle not persisted because chapterTitlePromise should be used outside of initFromWritten()
		this.parentDir = parentDir;

		this.mangaTitlePromise = new XMultiPromise();
		this.chaptersPromise = new XMultiPromise();
		Promise.allSettled([this.initFromWritten(mangaTitle), this.initFromGet()]).then(() => {
			if (this.mangaTitlePromise.rejected)
				this.mangaTitlePromise.resolve('');
			if (this.chaptersPromise.rejected)
				this.chaptersPromise.resolve([]);
		});
	}

	async initFromWritten(mangaTitle) {
		if (!this.id || !this.language || !mangaTitle || !this.parentDir)
			return;
		this.mangaTitlePromise.resolve(mangaTitle, true);
		let mangaDir = await this.mangaDirPromise;
		this.chaptersPromise.resolve((await readDir(mangaDir, true))
			.map(name => new Chapter('', name, mangaDir)), true);
	}

	async initFromGet() {
		if (!this.id || !this.language || !this.parentDir)
			return;
		this.responseTask = get(this.endpoint, this);
		let response = await this.responseTask.promise;
		this.mangaTitlePromise.resolve(`${response.data.chapters[0].mangaTitle} ${this.language}`);
		let mangaDir = await this.mangaDirPromise;
		this.chaptersPromise.resolve(response.data.chapters
			.filter(chapter => chapter.language === this.language)
			.reverse()
			.map(chapter => new Chapter(chapter.id, '', mangaDir)));

		write(path.resolve(mangaDir, 'data.json'),
			JSON.stringify({id: this.id, language: this.language}))
	}

	static async fromSampleChapterEndpoint(sampleChapterEndpoint, parentDir) {
		let chapterId = sampleChapterEndpoint.match(/chapter\/(\d+)/i)?.[1];
		return get(Chapter.endpoint(chapterId)).promise
			.then(response => new Manga(response.data.mangaId, response.data.language, '', parentDir))
			.catch(() => null);
	}

	static fromWritten(parentDir, title) {
		let mangaDir = path.resolve(parentDir, title);
		return fs.readFile(path.resolve(mangaDir, 'data.json')).then(file => {
			let {id, language} = JSON.parse(file);
			return new Manga(id, language, title, parentDir);
		});
	}

	async removeWritten() {
		await this.abort();
		await fs.rmdir(await this.mangaDirPromise, {recursive: true});
	}

	setHighPriority() {
		this.responseTask.moveToFront();
	}

	async abort() {
		this.aborted = true;
		await Promise.all((await this.chaptersPromise).map(chapter => chapter.abort()));
	}

	get endpoint() {
		return `https://mangadex.org/api/v2/manga/${this.id}/chapters`;
	}

	get mangaDirPromise() {
		return this.mangaTitlePromise.then(mangaTitle =>
			path.resolve(this.parentDir, mangaTitle));
	}
}

class Chapter {
	constructor(id, chapterTitle, mangaDir) {
		this.id = id; // optional
		// chapterTitle (optional) not persisted because chapterTitlePromise should be used outside of initFromWritten()
		this.mangaDir = mangaDir;

		this.chapterTitlePromise = new XMultiPromise();
		this.pagesPromise = new XMultiPromise();
		Promise.allSettled([this.initFromWritten(chapterTitle), this.initFromGet()]).then(() => {
			if (this.chapterTitlePromise.rejected)
				this.chapterTitlePromise.resolve('');
			if (this.pagesPromise.rejected)
				this.pagesPromise.resolve([]);
		});
	}

	async initFromWritten(chapterTitle) {
		if (!chapterTitle || !this.mangaDir)
			return;
		this.chapterTitlePromise.resolve(chapterTitle, true);
		let chapterDir = await this.chapterDirPromise;
		this.pagesPromise.resolve((await readDir(chapterDir))
			.map(name => new Page('', '', name, chapterDir)), true);
	}

	async initFromGet(retry = false) {
		if (!this.id || !this.mangaDir)
			return;
		this.responseTask = get(this.endpoint, this, undefined, undefined, retry);
		let response = await this.responseTask.promise;
		this.chapterTitlePromise.resolve(`${response.data.volume || '_'} ${response.data.chapter || '_'}`);
		let chapterDir = await this.chapterDirPromise;
		this.pagesPromise.resolve(response.data.pages.map(pageId =>
			new Page(response.data.server, response.data.hash, pageId, chapterDir, retry)));
	}

	async retry() {
		await this.abort();
		this.aborted = false;
		await this.initFromGet(true);
	}

	setHighPriority() {
		// responseTask can be undefined if chapter was constructed without an id
		this.responseTask?.moveToFront();
	}

	async abort() {
		this.aborted = true;
		(await this.pagesPromise).forEach(page => page.abort());
	}

	get endpoint() {
		return Chapter.endpoint(this.id);
	}

	static endpoint(id) {
		return `https://mangadex.org/api/v2/chapter/${id}`;
	}

	get chapterDirPromise() {
		return this.chapterTitlePromise.then(chapterTitle =>
			path.resolve(this.mangaDir, chapterTitle));
	}
}

class Page {
	constructor(server, hash, id, chapterDir, ignoreWritten = false) {
		this.server = server; // optional
		this.hash = hash; // optional
		this.id = id;
		this.chapterDir = chapterDir;
		this.ignoreWritten = ignoreWritten;

		this.imagePromise = new XPromise();
		this.writePromise = new XPromise();
		this.initFromWritten()
			.catch(() => this.initFromGet())
			.catch(() => {
				this.imagePromise.resolve();
				this.writePromise.resolve();
				// console.error('Failed to initialize page', this);
			});
	}

	async initFromWritten() {
		if (!this.id || !this.chapterDir || this.ignoreWritten)
			return;
		this.imagePromise.resolve(await fs.readFile(this.pagePath));
		this.writePromise.resolve();
	}

	async initFromGet() {
		if (!this.id || !this.chapterDir || !this.server || !this.hash)
			return;
		let buffer = Buffer.from(await get(this.endpoint, this, {responseType: 'arraybuffer'}, getQueuePages).promise);
		this.imagePromise.resolve(buffer);
		await write(this.pagePath, buffer);
		this.writePromise.resolve();
	}

	abort() {
		this.aborted = true;
	}

	get endpoint() {
		return `${this.server}${this.hash}/${this.id}`;
	}

	get pagePath() {
		return path.resolve(this.chapterDir, this.id);
	}

	get imageSrc() {
		return this.imagePromise
			.then(image => 'data:image/jpeg;base64,' + image.toString('base64'))
			.catch(() => '');
	}
}

module.exports = Manga;

// TODO
// load offline first then bother with online
// accept manga id urls
// button to restart downloads
// only bother for 1 chapter version per chapter (i.e. ignore multiple translations)
// cache
// error handling
