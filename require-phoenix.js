'use strict';

const fs = require('fs');
const module_path = require('path');

const cache = new Map();

const log = (...args) => console.log('[require-phoenix]', ...args);

const _require = (path_given) => {
	// log(path_given);

	if('.' !== path_given[0] && '/' !== path_given[0]){
		return require(path_given);
	}

	const path_caller = (() => {
		const originalFunc = Error.prepareStackTrace;
		let callerfile;

		try {
			const err = new Error();
			let currentfile;
			//log('err.stack', new Error().stack);

			Error.prepareStackTrace = (_, stack) => stack;

			currentfile = err.stack.shift().getFileName();
			//log('currentfile', currentfile);

			while(err.stack.length){
				const err_row = err.stack.shift();
				callerfile = err_row.getFileName();
				//log('err_row', err_row.toString());
				//log('callerfile', callerfile);
				if(null !== callerfile && void 0 !== callerfile && currentfile !== callerfile){
					break;
				}
			}
		}
		catch(e){}

		Error.prepareStackTrace = originalFunc;

		return callerfile;
	})();
	// log('path_caller', path_caller);

	// log('resolve', require.resolve(path_given));

	// log('ctx dir', module_path.parse(path_caller).dir);
	// log('ctx path_given', path_given);
	// log('ctx path', module_path.join(module_path.parse(path_caller).dir, path_given));

	const path = require.resolve(module_path.join(module_path.parse(path_caller).dir, path_given));
	// log('path', path);

	if(cache.has(path)){
		//log(`${path} HIT`);
		const cached = cache.get(path);
		cached.callers.add(path_caller);
		if(null === cached.module){
			throw new Error(`Cannot find module '${path}'`);
		}
		else {
			return cached.module;
		}
	}
	else {
		//log(`${path} CACHING`);

		const module = require(path);

		cache.set(path, {
			path,
			module,
			callers: new Set([ path_caller ]),
			module_updated: Date.now(),
			file_updated: Date.now()
		});

		return module;
	}
};

module.exports = _require;
module.exports.require = _require;

const getFileUpdateTime = (path) => new Promise((resolve, reject) => {
	fs.stat(path, (err, stat) => {
		if(err){
			if('ENOENT' === err.code){
				resolve(Number.MAX_VALUE);
			}
			else {
				reject(err);
			}
		}
		else {
			resolve(stat.mtime.getTime());
		}
	});
});
module.exports.getPendingModules = async () => {
	const modules_pending = new Set();

	for(const el of cache.values()){
		// log('path', el.path);
		const file_modify_time = await getFileUpdateTime(el.path);
		// log('file modify time', file_modify_time);
		// log('module_updated', el.module_updated);
		if(file_modify_time > el.module_updated){
			log(`[PENDING] ${el.path}`);
			modules_pending.add(el.path);
		}
	}

	return modules_pending;
};

const update = async () => {
	const modules_pending_now = await module.exports.getPendingModules();
	log('modules_pending_now', modules_pending_now);

	const modules_to_reload = new Set();
	const worker = (paths) => {
		for(const path of paths){
			// log('update', 'path', path);
			if(cache.has(path) && modules_to_reload.has(path) === false){
				modules_to_reload.add(path);
				worker(cache.get(path).callers);
			}
		}
	};
	worker(modules_pending_now);

	log('modules_to_reload', modules_to_reload);

	for(const path of modules_to_reload){
		const module_require = require.cache[path];
		const module_require_exists = path in require.cache;
		// log('module_require_exists', module_require_exists);
		delete require.cache[path];

		try {
			const cached = cache.get(path);
			cached.module_updated = Date.now();
			cached.module = require(path);
		}
		catch(err){
			if(cache.has(path)){
				cache.get(path).module = null;
			}
		}

		if(module_require_exists){
			require.cache[path] = module_require;
		}
		else {
			delete require.cache[path];
		}
	}
};
module.exports.update = update;
module.exports.killAndRevive = update;
