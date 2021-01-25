const {importUtil, XElement} = require('xx-element');
const {template, name} = importUtil(__filename);
const Storage = require('../../services/Storage');
const Manga = require('../../services/Manga');

customElements.define(name, class extends XElement {
	static get attributeTypes() {
		return {
			manga: {type: XElement.PropertyTypes.object},
			chapter: {type: XElement.PropertyTypes.object},
			page: {type: XElement.PropertyTypes.object},
		};
	}

	static get htmlTemplate() {
		return template;
	}

	async connectedCallback() {
		// todo dequeu select async requests if a newer request has been recieved
		this.$('#chapter-selector').addEventListener('select', async ({detail: [_, i]}) =>
			this.chapter = (await this.manga.chaptersPromise)[i]);
		this.$('#page-selector').addEventListener('select', async ({detail: [_, i]}) =>
			this.page = (await this.chapter.pagesPromise)[i]);
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
			this.$('#page-selector').options = pages.map(page => page.id);
			this.page = pages[0];
		});
	}

	set page(value) {
		value.imagePromise.then(image => {
			if (value !== this.page) return;
			this.$('#page-view').src = 'data:image/jpeg;base64,' + image.toString('base64');
		});
	}
});
