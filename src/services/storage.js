const envPaths = require('env-paths');

class Storage {
	constructor() {
		this.dataDir = envPaths('mangadex-offline').data;
	}

	get mangaList() {
	}
}

module.exports = new Storage();
