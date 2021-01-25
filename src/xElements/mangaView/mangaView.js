const {importUtil, XElement} = require('xx-element');
const {template, name} = importUtil(__filename);
const Storage = require('../../services/Storage');
const Manga = require('../../services/Manga');

customElements.define(name, class extends XElement {
	static get attributeTypes() {
		return {
			manga: {type: XElement.PropertyTypes.object},
			chapter: {type: XElement.PropertyTypes.object},
		};
	}

	static get htmlTemplate() {
		return template;
	}

	async connectedCallback() {
		// todo dequeu select async requests if a newer request has been received
		this.$('#chapter-selector').addEventListener('select', async ({detail: [_, i]}) =>
			this.chapter = (await this.manga.chaptersPromise)[i]);
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
});
