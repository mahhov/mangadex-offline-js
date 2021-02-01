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
		this.loadChaptersFromWrittenPromise = this.loadChaptersFromWritten().catch(() => 0);
		this.loadChaptersFromGetPromise = this.loadChaptersFromGet().catch(() => 0);
	}

	async loadChaptersFromWritten() {
		this.addChapters((await readDir(this.mangaDir, true))
			.map(chapterTitle => [Chapter.parseTitle(chapterTitle).id, chapterTitle]));
	}

	async loadChaptersFromGet() {
		this.responseTask = get(this.endpoint, this);
		let response = await this.responseTask.promise;
		this.addChapters(response.data.chapters
			.filter(chapterData => chapterData.language === this.language)
			.reverse()
			.map(chapterData =>
				[chapterData.id, Chapter.title(chapterData.id, chapterData.volume, chapterData.chapter)]));
	}

	static fromSampleMangaEndpoint(endpoint, parentDir) {
		let mangaId = endpoint.match(/(?:manga|title)\/(\d+)/i)?.[1];
		if (!mangaId) return;
		return get(Manga.endpoint(mangaId)).promise
			.then(response => Manga.fromChapterData(response.data.chapters[0], parentDir, 'gb'))
			.catch(() => null);
	}

	static fromSampleChapterEndpoint(endpoint, parentDir) {
		let chapterId = endpoint.match(/chapter\/(\d+)/i)?.[1];
		if (!chapterId) return;
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
		let {id, language} = Manga.parseTitle(title);
		return new Manga(id, language, title, parentDir);
	}

	addChapters(chapterIdTitleTuples) {
		let newChapters = chapterIdTitleTuples
			.filter(([id]) => !this.chaptersStream.value.some(chapter => chapter.id === id))
			.map(([id, chapterTitle]) => new Chapter(id, chapterTitle, this.mangaDir));
		if (newChapters.length)
			this.chaptersStream.add([...this.chaptersStream.value, ...newChapters]
				.sort((chapter1, chapter2) => sortNames(chapter1.title, chapter2.title)));
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
		let [_, name, language, id] = title.match(/(.*) ([^\s]*) ([^\s]*)/);
		return {name, language, id};
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
		this.loadPagesFromWrittenPromise = this.loadPagesFromWritten().catch(() => 0);
		this.loadPagesFromGetPromise = this.loadPagesFromGet().catch(() => 0);
	}

	async loadPagesFromWritten() {
		this.addPages((await readDir(this.chapterDir)).map(pageId => [pageId]));
	}

	async loadPagesFromGet() {
		this.responseTask = get(this.endpoint, this, undefined, undefined, this.retryMode);
		let response = await this.responseTask.promise;
		this.addPages(response.data.pages.map(pageId =>
			[pageId, Promise.resolve(response.data.server), Promise.resolve(response.data.hash)]));
	}

	addPages(pageIdServerPromiseHashPromiseTuples) {
		let newPages = pageIdServerPromiseHashPromiseTuples
			.filter(([id, serverPromise = new XPromise(), hashPromise = new XPromise()]) => {
				let duplicate = this.pagesStream.value.find(page => page.id === id);
				if (!duplicate) return true;
				duplicate.serverPromise = Promise.any([duplicate.serverPromise, serverPromise]);
				duplicate.hashPromise = Promise.any([duplicate.hashPromise, hashPromise]);
			})
			.map((([id, serverPromise = new XPromise(), hashPromise = new XPromise()]) =>
				new Page(id, this.chapterDir, serverPromise, hashPromise, this.retryMode)));
		if (newPages.length)
			this.pagesStream.add([...this.pagesStream.value, ...newPages]
				.sort((page1, page2) => sortNames(page1.id, page2.id)));
	}

	async retry() {
		this.retryMode = true;
		this.pagesStream.add([]);
		if (this.responseTask?.done)
			this.loadPagesFromGet().catch(() => 0);
		else
			this.setHighPriority();
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
		return {volume, chapter, id: Number(id)};
	}

	get chapterDir() {
		return path.resolve(this.mangaDir, this.title);
	}
}

class Page {
	constructor(id, chapterDir, serverPromise, hashPromise, forceGet = false) {
		this.id = id;
		this.chapterDir = chapterDir;
		this.serverPromise = serverPromise;
		this.hashPromise = hashPromise;

		this.imagePromise = new XPromise();
		this.writePromise = new XPromise();
		(forceGet ?
				this.initFromGet(true) :
				this.initFromWritten()
					.catch(() => this.initFromGet())
		)
			.catch(() => {
				this.imagePromise.resolve();
				this.writePromise.resolve();
			});
	}

	async initFromWritten() {
		this.imagePromise.resolve(await fs.readFile(this.pagePath));
		this.writePromise.resolve();
	}

	async initFromGet(highPriority = false) {
		this.responseTask = get(await this.endpoint, this, {responseType: 'arraybuffer'}, getQueuePages, highPriority);
		let response = await this.responseTask.promise;
		let buffer = Buffer.from(response);
		this.imagePromise.resolve(buffer);
		await write(this.pagePath, buffer);
		this.writePromise.resolve();
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

// high priority not working
// write seems stuck
