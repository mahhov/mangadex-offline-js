const {importUtil, XElement} = require('xx-element');
const {template, name} = importUtil(__filename);

customElements.define(name, class extends XElement {
	static get attributeTypes() {
		return {
			title: {},
			selected: {type: XElement.PropertyTypes.boolean},
			chaptersCount: {type: XElement.PropertyTypes.number},
			requestsCount: {type: XElement.PropertyTypes.number},
			requestReadsCount: {type: XElement.PropertyTypes.number},
			pagesCount: {type: XElement.PropertyTypes.number},
			pageWritesCount: {type: XElement.PropertyTypes.number},
		};
	}

	static get htmlTemplate() {
		return template;
	}

	connectedCallback() {
		this.classList.add('interactable', 'interactable-container');

		this.addEventListener('click', () => this.emit('view'));
		this.$('#remove').addEventListener('click', e => {
			e.stopPropagation();
			this.emit('remove');
		});
	}

	set title(value) {
		this.$('#title').textContent = value;
	}

	set selected(value) {
		this.classList.toggle('selected', value);
	}

	set chaptersCount(value) {
		this.$('#chapters-count').textContent = value;
	}

	set requestsCount(value) {
		this.$('#progress-bar').primary = this.primary;
	}

	set requestReadsCount(value) {
		this.$('#progress-bar').primary = this.primary;
	}

	set pagesCount(value) {
		this.$('#progress-bar').secondary = this.secondary;
	}

	set pageWritesCount(value) {
		this.$('#progress-bar').secondary = this.secondary;
	}

	get primary() {
		return this.requestReadsCount / this.requestsCount;
	}

	get secondary() {
		return Math.min(this.pageWritesCount / this.pagesCount, this.primary);
	}

	updateProgress(manga) {
		let chapters = manga.chaptersStream.value;
		let pages = chapters.flatMap(chapter => chapter.pagesStream.value);
		let pagesPerChapter = chapters
			.map(chapter => chapter.pagesStream.value.length)
			.filter(pagesCount => pagesCount)
			.reduce((a, b, i, array) => a + b / array.length, 0);

		this.title = manga.title;
		this.chaptersCount = chapters.length;
		this.requestsCount = 1 + chapters.length * (pagesPerChapter + 1);
		this.requestReadsCount = [
			manga.responseTask.promise,
			...chapters.map(chapter => chapter.responseTask.promise),
			...pages.map(page => page.imagePromise),
		].filter(promise => promise.done).length;
		this.pagesCount = chapters.length * pagesPerChapter;
		this.pageWritesCount = pages.filter(page => page.writePromise.done).length;
	}

	async setMangaPromise(mangaPromise) {
		// should only be invoked once
		let manga = await mangaPromise;
		this.updateProgress(manga);
		manga.loadChaptersFromWrittenPromise.then(() => this.updateProgress(manga));
		manga.loadChaptersFromGetPromise.then(() => this.updateProgress(manga));
		let chaptersListened = [];
		manga.chaptersStream.on(chapters =>
			chapters
				.filter(chapter =>
					!chaptersListened.some(chapterListened => chapterListened === chapter))
				.forEach(chapter => {
					chaptersListened.push(chapter);
					chapter.loadPagesFromWrittenPromise.then(() => this.updateProgress(manga));
					chapter.loadPagesFromGetPromise.then(() => this.updateProgress(manga));
					let pagesListened = [];
					chapter.pagesStream.on(pages =>
						pages
							.filter(page =>
								!pagesListened.some(pageListened => pageListened === page))
							.forEach(page => {
								pagesListened.push(page);
								page.imagePromise.then(() => this.updateProgress(manga));
								page.writePromise.then(() => this.updateProgress(manga));
							}));
				}));
	}
});
