const {importUtil, XElement} = require('xx-element');
const {template, name} = importUtil(__filename);
const Average = require('../../services/Averager');

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
		this.$('#container').classList.toggle('selected', value);
	}

	set chaptersCount(value) {
		this.$('#chapters-count').textContent = value;
	}

	set requestsCount(value) {
		this.$('#progress-bar').primary = this.requestReadsCount / this.requestsCount;
	}

	set requestReadsCount(value) {
		this.$('#progress-bar').primary = this.requestReadsCount / this.requestsCount;
	}

	set pagesCount(value) {
		this.$('#progress-bar').secondary = this.pageWritesCount / this.pagesCount;
	}

	set pageWritesCount(value) {
		this.$('#progress-bar').secondary = this.pageWritesCount / this.pagesCount;
	}

	async setManga(manga) {
		// should only be invoked once
		this.manga = manga;

		this.title = await this.manga.mangaTitlePromise;
		this.chaptersCount = 0;
		this.requestsCount = 0;
		this.requestReadsCount = 0;
		this.pagesCount = 0;
		this.pageWritesCount = 0;
		this.pagesPerChapter = new Average();

		this.requestsCount = 1;
		let chapters = await this.manga.chaptersPromise;
		this.chaptersCount += chapters.length;
		this.requestsCount = 1 + chapters.length;
		this.requestReadsCount += 1;
		chapters.forEach(async chapter => {
			let pages = await chapter.pagesPromise;
			this.pagesPerChapter.add(pages.length);
			this.requestsCount = 1 + chapters.length * (this.pagesPerChapter.average + 1);
			this.requestReadsCount += 1;
			this.pagesCount = chapters.length * this.pagesPerChapter.average;
			pages.forEach(async page => {
				await page.dataPromise;
				this.requestReadsCount += 1;
				await page.writePromise;
				this.pageWritesCount += 1;
			});
		});
	}
});
