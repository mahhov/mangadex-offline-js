const fs = require('fs').promises;
const path = require('path');
const dataDir = require('env-paths')('mangadex-offline').data;
const axios = require('axios');
const RateLimitedRetryQueue = require('./RateLimitedRetryQueue');
const XPromise = require('./XPromise');

let getQueueChapters = new RateLimitedRetryQueue(100, undefined, 10);
let getQueuePages = new RateLimitedRetryQueue(100, undefined, 10);
let get = (endpoint, options = undefined, queue = getQueueChapters) =>
	queue.add(async () => {
		try {
			return (await axios.get(endpoint, options)).data;
		} catch {
			return {};
		}
	}); // todo resolve/reject

let writeQueue = new RateLimitedRetryQueue(100, undefined, 10);
let write = (path, data) =>
	writeQueue.add(() => fs.writeFile(path, data));

class Manga {
	constructor(id, language) {
		this.id = id;
		this.language = language;

		this.dataPromise = new XPromise(get(this.endpoint));
		this.mangaTitlePromise = this.dataPromise.xThen(dataObj =>
			dataObj.data.chapters[0]?.mangaTitle);
		this.chaptersPromise = this.dataPromise.xThen(dataObj =>
			dataObj.data.chapters
				.filter(chapter => chapter.language === this.language)
				.reverse()
				.map(chapter => new Chapter(chapter.id)));
		this.writePromise = new XPromise();
	}

	static async fromSampleChapterEndpoint(sampleChapterEndpoint) {
		let chapterId = sampleChapterEndpoint.match(/chapter\/(\d+)/i)[1];
		let sampleChapterResponse = await get(Chapter.endpoint(chapterId));
		let mangaId = sampleChapterResponse.data.mangaId;
		let language = sampleChapterResponse.data.language;
		return new Manga(mangaId, language);
	}

	async write(dir) {
		let mangaDir = path.resolve(dir, await this.mangaTitlePromise);
		await Promise.all((await this.chaptersPromise).map(chapter => chapter.write(mangaDir)));
		this.writePromise = new XPromise().resolve();
	}

	get endpoint() {
		return `https://mangadex.org/api/v2/manga/${this.id}/chapters`
	}

	get asJson() {
		return {
			id: this.id,
			language:this.language,
			mangaTitle:this.mangaTitlePromise.resolvedObj,
			chapters: this.chaptersPromise.resolvedObj?.map(chapter => chapter.asJson),
		};
	}
}

class Chapter {
	constructor(id) {
		this.id = id;

		this.dataPromise = new XPromise(get(this.endpoint));
		this.chapterTitlePromise = this.dataPromise.xThen(dataObj =>
			`${dataObj.data.volume} ${dataObj.data.chapter}`);
		this.pagesPromise = this.dataPromise.xThen(dataObj => {
			let {server, hash, pages} = dataObj.data;
			return pages.map(page => new Page(server, hash, page));
		});
		this.writePromise = new XPromise();
	}

	async write(dir) {
		let chapterDir = path.resolve(dir, await this.chapterTitlePromise);
		await fs.mkdir(chapterDir, {recursive: true});
		await Promise.all((await this.pagesPromise).map(page => page.write(chapterDir)));
		this.writePromise = new XPromise().resolve();
	}

	get endpoint() {
		return Chapter.endpoint(this.id);
	}

	static endpoint(id) {
		return `https://mangadex.org/api/v2/chapter/${id}`;
	}

	get asJson() {
		return {
			id: this.id,
			chapterTitle: this.chapterTitlePromise.resolvedObj,
			pages: this.pagesPromise.resolvedObj?.map(page => page.asJson),
		};
	}
}

class Page {
	constructor(server, hash, page) {
		this.server = server;
		this.hash = hash;
		this.page = page;

		this.dataPromise = new XPromise(get(
			this.endpoint,
			{responseType: 'arraybuffer'},
			getQueuePages));
		this.writePromise = new XPromise();
	}

	async write(dir) {
		await write(path.resolve(dir, this.page), await this.dataPromise);
		this.writePromise = new XPromise().resolve();
	}

	get endpoint() {
		return `${this.server}${this.hash}/${this.page}`;
	}

	get asJson() {
		return {
			page: this.page,
		};
	}
}

module.exports = Manga;

// TODO
// progress bar
// viewer
// only bother for 1 chapter version per chapter (i.e. ignore multiple translations)
// skip already downloaded
// cache
