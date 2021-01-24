const fs = require('fs').promises;
const path = require('path');
const dataDir = require('env-paths')('mangadex-offline').data;
const axios = require('axios');
const RateLimitedRetryQueue = require('./RateLimitedRetryQueue');
const XPromise = require('./XPromise');

let getQueueChapters = new RateLimitedRetryQueue(100, undefined, 10);
let getQueuePages = new RateLimitedRetryQueue(100, undefined, 10);
let get = (endpoint, abortObj = {}, options = undefined, queue = getQueueChapters) =>
	queue.add(() => {
		if (abortObj.aborted) return;
		return axios.get(endpoint, options)
			.then(response => response.data)
			.catch(() => null);
	});

let writeQueue = new RateLimitedRetryQueue(100, undefined, 10);
let write = (path, data) =>
	writeQueue.add(() => fs.writeFile(path, data));

class Manga {
	constructor(id, language, dir = undefined) {
		this.id = id;
		this.language = language;

		this.dataPromise = get(this.endpoint, this);
		this.mangaTitlePromise = this.dataPromise
			.then(response => response.data.chapters[0].mangaTitle)
			.catch(() => '');
		this.chaptersPromise = this.dataPromise
			.then(response => response.data.chapters
				.filter(chapter => chapter.language === this.language)
				.reverse()
				.map(chapter => new Chapter(chapter.id, dir)))
			.catch(() => []);
		this.writePromise = new XPromise();
	}

	static fromSampleChapterEndpoint(sampleChapterEndpoint) {
		let chapterId = sampleChapterEndpoint.match(/chapter\/(\d+)/i)[1];
		return get(Chapter.endpoint(chapterId, this))
			.then(response => new Manga(response.mangaId, response.language))
			.catch(() => null);
	}

	static fromWritten(dir, title) {
		let mangaDir = path.resolve(dir, title);
		return fs.readFile(path.resolve(mangaDir, 'data.json')).then(file => {
			let {id, language} = JSON.parse(file);
			return new Manga(id, language);
		});
	}

	async write(dir) {
		let mangaDir = path.resolve(dir, await this.mangaTitlePromise);
		await Promise.all([
			write(path.resolve(mangaDir, 'data.json'), JSON.stringify({id: this.id, language: this.language})),
			...(await this.chaptersPromise).map(chapter => chapter.write(mangaDir)),
		]);
		this.writePromise.resolve();
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
	constructor(id, dir = undefined) {
		this.id = id;

		this.dataPromise = get(this.endpoint, this);
		this.chapterTitlePromise = this.dataPromise
			.then(response => `${response.data.volume} ${response.data.chapter}`)
			.catch(() => '');
		this.pagesPromise = this.dataPromise
			.then(response =>
				response.pages.map(page => new Page(response.server, response.hash, page, dir)))
			.catch(() => []);
		this.writePromise = new XPromise();
	}

	async write(dir) {
		let chapterDir = path.resolve(dir, await this.chapterTitlePromise);
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
	constructor(server, hash, page, dir = undefined) {
		this.server = server;
		this.hash = hash;
		this.page = page;
		this.dir = dir;

		this.dataPromise = get(
			this.endpoint,
			this,
			{responseType: 'arraybuffer'},
			getQueuePages);
		this.writePromise = new XPromise();
	}

	async write(dir) {
		await write(path.resolve(dir, this.page), await this.dataPromise);
		this.writePromise.resolve();
	}

	abort() {
		this.aborted = true;
	}

	get endpoint() {
		return `${this.server}${this.hash}/${this.page}`;
	}
}

module.exports = Manga;

// TODO
// skip already downloaded
// UI
// viewer
// error handling
// only bother for 1 chapter version per chapter (i.e. ignore multiple translations)
// cache
