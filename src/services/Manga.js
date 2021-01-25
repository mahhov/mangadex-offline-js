const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const RateLimitedRetryQueue = require('./RateLimitedRetryQueue');
const XPromise = require('./XPromise');

let getQueueChapters = new RateLimitedRetryQueue(100, undefined, 10);
let getQueuePages = new RateLimitedRetryQueue(100, undefined, 10);
let get = (endpoint, abortObj = {}, options = undefined, queue = getQueueChapters, highPriority = false) => {
	let handler = () =>
		abortObj.aborted ?
			Promise.resolve(null) :
			axios.get(endpoint, options).then(response =>
				abortObj.aborted ? null : response.data);
	return highPriority ? queue.addFront(handler) : queue.add(handler);
};

let writeQueue = new RateLimitedRetryQueue(100, undefined, 10);
let write = (path, data) =>
	writeQueue.add(() => fs.writeFile(path, data));

class Manga {
	constructor(id, language, mangaDir = '') {
		this.id = id;
		this.language = language;

		let responsePromise = get(this.endpoint, this).catch(() => null);
		this.mangaTitlePromise = responsePromise
			.then(response => `${response.data.chapters[0].mangaTitle} ${this.language}`)
			.catch(() => path.basename(mangaDir));
		this.chaptersPromise = responsePromise
			.then(response => response.data.chapters
				.filter(chapter => chapter.language === this.language)
				.reverse()
				.map(chapter => new Chapter(chapter.id, mangaDir)))
			.catch(async () =>
				(await fs.readdir(mangaDir))
					.filter(name => name !== 'data.json')
					.map(name => new Chapter('', mangaDir, name)));
		this.writePromise = new XPromise();
	}

	static fromSampleChapterEndpoint(sampleChapterEndpoint) {
		let chapterId = sampleChapterEndpoint.match(/chapter\/(\d+)/i)?.[1];
		return get(Chapter.endpoint(chapterId, this))
			.then(response => new Manga(response.data.mangaId, response.data.language))
			.catch(() => null);
	}

	static fromWritten(parentDir, title) {
		let mangaDir = path.resolve(parentDir, title);
		return fs.readFile(path.resolve(mangaDir, 'data.json')).then(file => {
			let {id, language} = JSON.parse(file);
			return new Manga(id, language, mangaDir);
		});
	}

	async write(parentDir) {
		let mangaDir = path.resolve(parentDir, await this.mangaTitlePromise);
		await Promise.all([
			write(path.resolve(mangaDir, 'data.json'), JSON.stringify({id: this.id, language: this.language})),
			...(await this.chaptersPromise).map(chapter => chapter.write(mangaDir)),
		]);
		this.writePromise.resolve();
	}

	async removeWritten(parentDir) {
		await this.abort();
		let mangaDir = path.resolve(parentDir, await this.mangaTitlePromise);
		await fs.rmdir(mangaDir, {recursive: true});
	}

	async abort() {
		this.aborted = true;
		(await this.chaptersPromise).forEach(chapter => chapter.abort());
	}

	get endpoint() {
		return `https://mangadex.org/api/v2/manga/${this.id}/chapters`
	}
}

class Chapter {
	constructor(id, mangaDir = '', chapterTitle = '') {
		this.init(id, mangaDir, chapterTitle);
	}

	init(id, mangaDir = '', chapterTitle = '') {
		this.id = id;
		let wasAborted = this.aborted;
		this.aborted = false;

		let responsePromise = get(this.endpoint, this, undefined, undefined, wasAborted).catch(() => null);
		this.chapterTitlePromise = responsePromise
			.then(response => `${response.data.volume || '_'} ${response.data.chapter || '_'}`)
			.catch(() => chapterTitle);
		this.pagesPromise = responsePromise
			.then(async response => {
				let chapterDir = path.resolve(mangaDir, await this.chapterTitlePromise);
				return response.data.pages.map(pageId =>
					new Page(response.data.server, response.data.hash, pageId, chapterDir));
			})
			.catch(async () => {
				let chapterDir = path.resolve(mangaDir, await this.chapterTitlePromise);
				return (await fs.readdir(path.resolve(mangaDir, chapterTitle)))
					.map(name => new Page('', '', name, chapterDir));
			});
		this.writePromise = new XPromise();
	}

	async retry() {
		await this.abort();
		this.init(this.id);
	}

	async write(mangaDir) {
		let chapterDir = path.resolve(mangaDir, await this.chapterTitlePromise);
		await fs.mkdir(chapterDir, {recursive: true});
		await Promise.all((await this.pagesPromise).map(page => page.write(chapterDir)));
		this.writePromise.resolve();
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
}

class Page {
	constructor(server, hash, id, chapterDir = '') {
		this.server = server;
		this.hash = hash;
		this.id = id;

		this.writePromise = new XPromise();
		this.imagePromise = fs.readFile(path.resolve(chapterDir, this.id))
			.then(buffer => {
				this.writePromise.resolve();
				return buffer;
			})
			.catch(async () =>
				Buffer.from(await get(this.endpoint, this, {responseType: 'arraybuffer'}, getQueuePages)))
			.catch(() => null);
	}

	async write(chapterDir) {
		await this.imagePromise;
		if (this.writePromise.resolved) return;
		await write(path.resolve(chapterDir, this.id), await this.imagePromise);
		this.writePromise.resolve();
	}

	abort() {
		this.aborted = true;
	}

	get endpoint() {
		return `${this.server}${this.hash}/${this.id}`;
	}

	get imageSrc() {
		return this.imagePromise
			.then(image => 'data:image/jpeg;base64,' + image.toString('base64'))
			.catch(() => '');
	}
}

module.exports = Manga;

// TODO
// allow manual loading of chapters
// button to restart downloads
// only bother for 1 chapter version per chapter (i.e. ignore multiple translations)
// cache
// error handling
