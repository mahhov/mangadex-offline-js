const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const RateLimitedRetryQueue = require('./RateLimitedRetryQueue');
const XPromise = require('./XPromise');
const XMultiPromise = require('./XMultiPromise');
const Stream = require('./Stream');

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

let sortNames = (name1 = '', name2 = '') => {
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
	readPath ? fs.readdir(readPath, {withFileTypes: true})
		.then(entries => entries
			.filter(entry => dirs ? entry.isDirectory() : entry.isFile())
			.map(entry => entry.name))
		.catch(() => []) : [];

class Manga {
	constructor(id, language, title, parentDir) {
		this.id = id;
		this.language = language;
		this.title = title;
		this.parentDir = parentDir;

		this.chaptersStream = new Stream(undefined, []);

		this.loadChaptersFromWritten();
		this.loadChaptersFromGet();
	}

	async loadChaptersFromWritten() {
		(await readDir(this.mangaDir, true)).forEach(chapterTitle =>
			this.addChapter(Chapter.parseTitle(chapterTitle).id, chapterTitle));
	}

	async loadChaptersFromGet() {
		this.responseTask = get(this.endpoint, this);
		let response = await this.responseTask.promise;
		response.data.chapters
			.filter(chapterData => chapterData.language === this.language)
			.reverse()
			.forEach(chapterData =>
				this.addChapter(chapterData.id, Chapter.title(chapterData.id, chapterData.volume, chapterData.chapter)));
		await write(path.resolve(this.mangaDir, 'data.json'),
			JSON.stringify({id: this.id, language: this.language}))
	}

	static async fromSampleMangaEndpoint(endpoint, parentDir) {
		let mangaId = endpoint.match(/manga\/(\d+)/i)?.[1];
		return get(Manga.endpoint(mangaId)).promise
			.then(response => Manga.fromChapterData(response.data.chapters[0], parentDir, 'gb'))
			.catch(() => null);
	}

	static async fromSampleChapterEndpoint(endpoint, parentDir) {
		let chapterId = endpoint.match(/chapter\/(\d+)/i)?.[1];
		return get(Chapter.endpoint(chapterId)).promise
			.then(response => Manga.fromChapterData(response.data, parentDir))
			.catch(() => null);
	}

	static fromChapterData(data, parentDir, language = data.language) {
		let title = Manga.title(data.mangaId, language, data.mangaTitle);
		return new Manga(data.mangaId, language, title, parentDir);
	}

	static fromWritten(parentDir, title) {
		let mangaDir = path.resolve(parentDir, title);
		return fs.readFile(path.resolve(mangaDir, 'data.json')).then(file => {
			let {id, language} = JSON.parse(file);
			return new Manga(id, language, title, parentDir);
		});
	}

	async addChapter(id, chapterTitle) {
		if (!this.chaptersStream.value.some(chapter => chapter.id === id)) {
			let chapter = new Chapter(id, chapterTitle, this.mangaDir);
			this.chaptersStream.add([...this.chaptersStream.value, chapter]
				.sort((chapter1, chapter2) => sortNames(chapter1.title, chapter2.title)));
		}
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
		this.chaptersStream.on(pages => pages.forEach(page => page.abort()));
		// todo this should wait for all pages to abort and hanlde async page creatijons after abort was called
	}

	get endpoint() {
		return Manga.endpoint(this.id);
	}

	static endpoint(id) {
		return `https://mangadex.org/api/v2/manga/${id}/chapters`;
	}

	static title(id = '_', language = '_', name = '_') {
		return `${name} ${language} ${id}`;
	}

	static parseTitle(title) {
		let [name, language, id] = title.split(' ');
		return [name, language, id];
	}

	get mangaDir() {
		return path.resolve(this.parentDir, this.title);
	}
}

class Chapter {
	constructor(id, title, mangaDir) {
		this.id = id;
		this.title = title;
		this.mangaDir = mangaDir;

		this.pagesStream = new Stream(undefined, []);

		this.loadPagesFromWritten();
		this.loadPagesFromGet();
	}

	async loadPagesFromWritten() {
		(await readDir(this.chapterDir)).forEach(pageId =>
			this.addPage(pageId));
	}

	async loadPagesFromGet() {
		this.responseTask = get(this.endpoint, this);
		let response = await this.responseTask.promise;
		response.data.pages.forEach(pageId =>
			this.addPage(pageId, Promise.resolve(response.data.server), Promise.resolve(response.data.hash)));
	}

	addPage(id, serverPromise = new XPromise(), hashPromise = new XPromise()) {
		let duplicate = this.pagesStream.value.find(page => page.id === id);
		if (duplicate) {
			duplicate.serverPromise = Promise.any([duplicate.serverPromise, serverPromise]);
			duplicate.hashPromise = Promise.any([duplicate.hashPromise, hashPromise]);
		} else {
			let page = new Page(id, this.chapterDir, serverPromise, hashPromise);
			this.pagesStream.add([...this.pagesStream.value, page]
				.sort((page1, page2) => sortNames(page1.id, page2.id)));
		}
	}

	async retry() {
		this.setHighPriority();
		(await this.pagesStream.promise).forEach(page => page.retry());
	}

	setHighPriority() {
		this.responseTask.moveToFront();
	}

	async abort() {
		this.aborted = true;
		this.pagesStream.on(pages => pages.forEach(page => page.abort()));
		// todo this should wait for all pages to abort and hanlde async page creatijons after abort was called
	}

	get endpoint() {
		return Chapter.endpoint(this.id);
	}

	static endpoint(id) {
		return `https://mangadex.org/api/v2/chapter/${id}`;
	}

	static title(id = '_', volume = '_', chapter = '_') {
		return `${volume} ${chapter} ${id}`;
	}

	static parseTitle(title) {
		let [volume, chapter, id] = title.split(' ');
		return {volume, chapter, id};
	}

	get chapterDir() {
		return path.resolve(this.mangaDir, this.title);
	}
}

class Page {
	constructor(id, chapterDir, serverPromise, hashPromise) {
		this.id = id;
		this.chapterDir = chapterDir;
		this.serverPromise = serverPromise;
		this.hashPromise = hashPromise;

		this.imagePromise = new XPromise();
		this.writePromise = new XPromise();

		this.initFromWritten()
			.catch(() => this.initFromGet())
			.catch(() => {
				this.imagePromise.resolve();
				this.writePromise.resolve();
			});
	}

	async initFromWritten() {
		this.imagePromise.resolve(await fs.readFile(this.pagePath));
		this.writePromise.resolve();
	}

	async initFromGet() {
		this.responseTask = get(await this.endpoint, this, {responseType: 'arraybuffer'}, getQueuePages);
		let response = await this.responseTask.promise;
		let buffer = Buffer.from(response);
		this.imagePromise.resolve(buffer);
		await write(this.pagePath, buffer);
		this.writePromise.resolve();
	}

	retry() {
		// todo
	}

	abort() {
		this.aborted = true;
	}

	get endpoint() {
		return Promise.all([this.serverPromise, this.hashPromise]).then(([server, hash]) =>
			`${server}${hash}/${this.id}`);
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
