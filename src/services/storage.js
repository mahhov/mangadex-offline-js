const fs = require('fs').promises;
const path = require('path');
const envPaths = require('env-paths');
const Manga = require('./Manga');

class Storage {
	constructor() {
		this.dataDir = envPaths('mangadex-offline').data;
	}

	get writtenMangas() {
		return fs.readdir(path.resolve(this.dataDir))
			.then(titles => titles.map(title => Manga.fromWritten(this.dataDir, title)))
			.catch(() => []);
	}
}

module.exports = new Storage();
