const fs = require('fs').promises;
const path = require('path');
const envPaths = require('env-paths');
const Manga = require('./Manga');

class Storage {
	static get dataDir() {
		return envPaths('mangadex-offline').data;
	}

	static get writtenMangas() {
		return fs.readdir(path.resolve(this.dataDir))
			.then(names => names.map(name => Manga.fromWritten(this.dataDir, name)))
			.catch(() => []);
	}
}

module.exports = Storage;
