const {importUtil, XElement} = require('xx-element');
const {template, name} = importUtil(__filename);
const Average = require('../../services/Averager');

customElements.define(name, class extends XElement {
	static get attributeTypes() {
		return {
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
		this.$('#progress-bar').second = this.pageWritesCount / this.pagesCount;
	}

	set pageWritesCount(value) {
		this.$('#progress-bar').second = this.pageWritesCount / this.pagesCount;
	}

	async setManga(manga) {
		// todo support multiple invocations
		this.chaptersCount = 0;
		this.requestsCount = 0;
		this.requestReadsCount = 0;
		this.pagesCount = 0;
		this.pageWritesCount = 0;
		// todo
		// this.predictedPagesCount = 0;
		// this.averagePagesPerChapter = new Average();

		this.requestsCount += 1;
		let chapters = await manga.chaptersPromise;
		this.chaptersCount += chapters.length;
		this.requestsCount += chapters.length;
		this.requestReadsCount += 1;
		chapters.forEach(async chapter => {
			let pages = await chapter.pagesPromise;
			this.requestsCount += pages.length;
			this.requestReadsCount += 1;
			this.pagesCount += pages.length;
			pages.forEach(async page => {
				await page.dataPromise;
				this.requestReadsCount += 1;
				await page.writePromise;
				this.pageWritesCount += 1;
			});
		});
	}
});
