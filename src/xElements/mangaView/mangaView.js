const {importUtil, XElement} = require('xx-element');
const {template, name} = importUtil(__filename);
const Storage = require('../../services/Storage');
const Manga = require('../../services/Manga');

customElements.define(name, class extends XElement {
	static get attributeTypes() {
		return {
			manga: {type: XElement.PropertyTypes.object},
			chapter: {type: XElement.PropertyTypes.object},
			chapterIndex: {type: XElement.PropertyTypes.number},
		};
	}

	static get htmlTemplate() {
		return template;
	}

	async connectedCallback() {
		this.$('#chapter-selector').addEventListener('select', e =>
			this.chapterIndex = e.detail);
		this.$('#next').addEventListener('click', () => {
			this.$('#chapter-selector').selectedIndex = ++this.chapterIndex;
			document.body.scrollTop = 0;
		});
	}

	set manga(value) {
		value.chaptersPromise.then(async chapters => {
			if (value !== this.manga) return;
			this.$('#chapter-selector').options = chapters.map(chapter => chapter.chapterTitlePromise);
			this.chapter = chapters[0];
		});
	}

	set chapter(value) {
		value.pagesPromise.then(pages => {
			if (value !== this.chapter) return;
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
