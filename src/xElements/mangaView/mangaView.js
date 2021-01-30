const {importUtil, XElement} = require('xx-element');
const {template, name} = importUtil(__filename);
const path = require('path');
const Storage = require('../../services/Storage');
const Manga = require('../../services/Manga');

customElements.define(name, class extends XElement {
	static get attributeTypes() {
		return {
			zoom: {type: XElement.PropertyTypes.number},
			mangaPromise: {type: XElement.PropertyTypes.object},
			chapter: {type: XElement.PropertyTypes.object, allowRedundantAssignment: true},
			chapterIndex: {type: XElement.PropertyTypes.number, allowRedundantAssignment: true},
		};
	}

	static get htmlTemplate() {
		return template;
	}

	async connectedCallback() {
		this.zoom = 1;
		this.mangaPromise = Promise.resolve(null);

		this.$('#chapter-selector').addEventListener('select', e =>
			this.chapterIndex = e.detail);
		this.$('#retry').addEventListener('click', async () => {
			// todo
			// let manga = await this.mangaPromise;
			// if (!manga) return;
			// let chapter = (await (manga).chaptersPromise)[this.chapterIndex];
			// await chapter.retry();
			// this.chapterIndex = this.chapterIndex;
		});
		this.$('#zoom').addEventListener('input', () => this.zoom = this.$('#zoom').value);
		this.$('#next').addEventListener('click', () => {
			this.$('#chapter-selector').selectedIndex = ++this.chapterIndex;
			this.$('#images-container').scrollIntoView();
		});
	}

	set zoom(value) {
		this.$('#zoom-label').textContent = `x${value}`;
		this.$('#images-container').style.zoom = value;
	}

	set mangaPromise(valuePromise) {
		this.classList.remove('loaded-chapters');
		valuePromise.then(value => {
			if (!value || valuePromise !== this.mangaPromise) return;
			this.classList.add('loaded-chapters');
			value.setHighPriority();
			value.chaptersStream.on((chapters, cancel) => {
				if (valuePromise === this.mangaPromise)
					this.$('#chapter-selector').options = chapters.map(chapter => chapter.title);
				else
					cancel();
			});
			this.chapterIndex = 0;
		})
	}

	set chapter(value) {
		if (!value) return; // can be undefined for mangas with 0 chapters
		value.setHighPriority();
		this.clearChildren('#images-container');
		value.pagesStream.on((pages, cancel) => {
			if (value === this.chapter)
				pages.forEach(async page => {
					let image = document.createElement('img');
					this.$('#images-container').appendChild(image);
					image.src = await page.imageSrc;
				});
			else
				cancel();
		});
	}

	set chapterIndex(value) {
		this.mangaPromise.then(async manga => {
			if (value === this.chapterIndex && manga)
				this.chapter = manga.chaptersStream.value[value];
		});
	}
});
