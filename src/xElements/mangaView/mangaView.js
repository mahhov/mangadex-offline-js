const {importUtil, XElement} = require('xx-element');
const {template, name} = importUtil(__filename);
const path = require('path');
const Storage = require('../../services/Storage');
const Manga = require('../../services/Manga');

customElements.define(name, class extends XElement {
	static get attributeTypes() {
		return {
			manga: {type: XElement.PropertyTypes.object},
			chapter: {type: XElement.PropertyTypes.object, allowRedundantAssignment: true},
			chapterIndex: {type: XElement.PropertyTypes.number, allowRedundantAssignment: true},
		};
	}

	static get htmlTemplate() {
		return template;
	}

	async connectedCallback() {
		this.manga = null;

		this.$('#chapter-selector').addEventListener('select', e =>
			this.chapterIndex = e.detail);
		this.$('#retry-chapter').addEventListener('click', async () => {
			if (!this.manga) return;
			let chapter = (await this.manga.chaptersPromise)[this.chapterIndex];
			await chapter.retry();
			chapter.write(path.resolve(Storage.dataDir, await this.manga.mangaTitlePromise));
			this.chapterIndex = this.chapterIndex;
		});
		this.$('#next').addEventListener('click', () => {
			this.$('#chapter-selector').selectedIndex = ++this.chapterIndex;
			document.body.scrollTop = 0; // todo use scroll into view
		});
	}

	set manga(value) {
		this.classList.remove('loaded-chapters');
		if (!value) return;
		value.chaptersPromise.then(chapters => {
			if (value !== this.manga) return;
			this.classList.add('loaded-chapters');
			this.$('#chapter-selector').options = chapters.map(chapter => chapter.chapterTitlePromise);
			this.chapterIndex = 0;
		});
	}

	set chapter(value) {
		this.classList.remove('loaded-pages');
		value.pagesPromise.then(pages => {
			if (value !== this.chapter) return;
			this.classList.add('loaded-pages');
			this.clearChildren('#images-container');
			pages.forEach(async page => {
				let image = document.createElement('img');
				this.$('#images-container').appendChild(image);
				image.src = await page.imageSrc;
			});
		});
	}

	set chapterIndex(value) {
		this.manga?.chaptersPromise?.then(chapters => {
			if (value !== this.chapterIndex) return;
			this.chapter = chapters[value];
		});
	}
});
