import { Configuration as ConfigurationContract } from "@zxteam/contract";
import { ArgumentError, ConfigurationError } from "@zxteam/errors";

import * as _ from "lodash";
import * as path from "path";
import * as fs from "fs";
import { userInfo } from "os";
import { promisify } from "util";

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export function chainConfiguration(...configurations: ReadonlyArray<ConfigurationContract>): ConfigurationContract {
	if (configurations.length === 0) {
		throw new ArgumentError("configurations", "Expected at least one sub configuration");
	}
	const items = configurations.slice();
	function binder(
		method: keyof ConfigurationContract, callback: (configurationItem: ConfigurationContract, key: string) => any
	): (key: string, defaultValue?: any) => any {
		function bind(key: string, defaultValue?: any) {
			for (let itemIndex = 0; itemIndex < items.length; ++itemIndex) {
				const configurationItem: ConfigurationContract = items[itemIndex];
				if (configurationItem.has(key)) {
					return callback(configurationItem, key);
				}
			}
			if (defaultValue !== undefined) { return defaultValue; }
			const item0 = items[0];
			const parentNamespace = _.isEmpty(item0.configurationNamespace) ? undefined : item0.configurationNamespace;
			throwWrongKeyError(key, parentNamespace);
		}
		return bind;
	}
	const chainConfigurationInstance: ConfigurationContract = {
		get configurationNamespace() { return items[0].configurationNamespace; },
		get: binder("get", (cfg, key) => cfg.get(key)),
		getBase64: binder("getBase64", (cfg, key) => cfg.getBase64(key)),
		getBoolean: binder("getBoolean", (cfg, key) => cfg.getBoolean(key)),
		getConfiguration(configurationNamespace: string): ConfigurationContract {
			const subItems: Array<ConfigurationContract> = [];
			items.forEach(function (item) {
				if (item.hasNamespace(configurationNamespace)) {
					subItems.push(item.getConfiguration(configurationNamespace));
				}
			});
			if (subItems.length === 0) {
				// Force underlaying config to raise error
				items[0].getConfiguration(configurationNamespace);

				// just a guard, should not happens if underlaying configuration is implemented correctly
				throw new ConfigurationError(
					`Namespace '${configurationNamespace}' was not found in the configuration.`,
					configurationNamespace, null
				);
			}
			return chainConfiguration(...subItems);
		},
		getEnabled: binder("getEnabled", (cfg, key) => cfg.getEnabled(key)),
		getFloat: binder("getFloat", (cfg, key) => cfg.getFloat(key)),
		getInteger: binder("getInteger", (cfg, key) => cfg.getInteger(key)),
		getString: binder("getString", (cfg, key) => cfg.getString(key)),
		getURL: binder("getURL", (cfg, key) => cfg.getURL(key)),
		has(key: string): boolean {
			for (let itemIndex = 0; itemIndex < items.length; ++itemIndex) {
				if (items[itemIndex].has(key)) { return true; }
			}
			return false;
		},
		hasNamespace(configurationNamespace: string): boolean {
			for (let itemIndex = 0; itemIndex < items.length; ++itemIndex) {
				const item = items[itemIndex];
				if (item.hasNamespace(configurationNamespace)) {
					return true;
				} else if (item.has(configurationNamespace)) {
					const maskedNamespaceValue = item.get(configurationNamespace);
					if (maskedNamespaceValue === "") {
						// This is masked namespace
						return false;
					}
				}
			}
			return false;
		},
		hasNonEmpty(key: string): boolean {
			for (let itemIndex = 0; itemIndex < items.length; ++itemIndex) {
				const item = items[itemIndex];
				if (item.has(key)) {
					return item.hasNonEmpty(key);
				}
			}
			return false;
		},
		keys() {
			return _.union(...items.map(item => item.keys()));
		}
	};
	return chainConfigurationInstance;
}
export function fileConfiguration(configFile: string): ConfigurationContract {
	const dict: Configuration.Dictionary = {};
	propertiesFileContentProcessor(configFile, (name: string, value: string) => {
		dict[name] = value;
	});
	return new Configuration(dict);
}
export function envConfiguration(): ConfigurationContract {
	const dict: Configuration.Dictionary = {};
	_.entries(process.env).forEach(([name, value]) => {
		if (value !== undefined) {
			dict[name] = value;
		}
	});
	const config = new Configuration(dict);

	// const adapter: ConfigurationContract = {
	// 	get configurationNamespace() { return config.configurationNamespace; },
	// 	get(key) { return config.get(key) },
	// };

	return config;
}
export function cmdConfiguration(): ConfigurationContract {
	//TODO
	throw new ConfigurationError("Not implemented yet", null, null);
}
/**
 * Loading values from files. A filename is used as key name.
 * Main reason for this is https://docs.docker.com/engine/swarm/secrets/
 * @param directory a directory where secret files are placed
 */
export async function secretsDirectoryConfiguration(directory?: string): Promise<ConfigurationContract> {
	if (directory === undefined) {
		// Setup default dir
		// https://docs.docker.com/engine/swarm/secrets/
		directory = "/run/secrets";
	}

	const dict: Configuration.Dictionary = {};
	const sourceDirectory = directory;
	const files: Array<string> = await readdir(sourceDirectory);
	await files.reduce(async (p, c) => {
		await p;
		const fullFileName = path.join(sourceDirectory, c);
		const stats = await stat(fullFileName);
		if (stats.isFile()) {
			const value = await readFile(fullFileName, "utf-8");
			dict[c] = value.trim();
		}
	}, Promise.resolve());

	return new Configuration(dict);
}
export function develVirtualFilesConfiguration(configDir: string, develSite: string): ConfigurationContract {
	if (!configDir) { throw new ArgumentError("configDir"); }
	if (!fs.existsSync(configDir)) {
		throw new ConfigurationError(
			"Bad configuration directory (not exists): " + configDir,
			null, null
		);
	}
	const projectConfigDir = path.join(configDir, "project.properties");

	const files: Array<string> = [];
	files.push(path.join(projectConfigDir, "config.properties"));
	files.push(path.join(projectConfigDir, "config-" + develSite + ".properties"));
	const userConfigDir = path.join(configDir, "user.properties");
	const currentUserName = userInfo().username;
	if (currentUserName) {
		files.push(path.join(userConfigDir, "config-" + currentUserName + ".properties"));
	}

	const dict: Configuration.Dictionary = {};
	files.forEach((file) => {
		if (!fs.existsSync(file)) {
			console.warn("Skip a configuration file (not exists): " + file);
			throw new ConfigurationError(
				"Skip a configuration file(not exists): " + file,
				null, null
			);
		}
		propertiesFileContentProcessor(file, (name: string, value: string) => {
			if (name in process.env) {
				dict[name] = process.env[name] as string;
			} else {
				dict[name] = value;
			}
		});
	});
	return new Configuration(dict);
}

export namespace Configuration {
	export type Dictionary = { [key: string]: string };
}

export class Configuration implements ConfigurationContract {
	private readonly _dict: Configuration.Dictionary;
	private readonly _parentNamespace?: string;

	public constructor(dict: Configuration.Dictionary, parentNamespace?: string) {
		this._dict = dict;
		if (parentNamespace !== undefined) {
			this._parentNamespace = parentNamespace;
		}
	}

	public get configurationNamespace(): string {
		if (this._parentNamespace !== undefined) {
			return this._parentNamespace;
		}
		return "";
	}

	public getConfiguration(configurationNamespace: string): ConfigurationContract {
		if (!configurationNamespace) { throw new ArgumentError("configurationNamespace"); }
		const subDict: Configuration.Dictionary = {};
		const criteria = configurationNamespace + ".";
		const criteriaLen = criteria.length;
		Object.keys(this._dict).forEach((key) => {
			if (key.length > criteriaLen && key.startsWith(criteria)) {
				const value = this._dict[key];
				subDict[key.substring(criteriaLen)] = value;
			}
		});
		if (Object.keys(subDict).length === 0) {
			const fullKeyName = this.getFullKey(configurationNamespace);
			throw new ConfigurationError(
				`Namespace '${fullKeyName}' was not found in the configuration.`,
				fullKeyName, null
			);
		}
		const parentNamespace = this._parentNamespace !== undefined ?
			`${this._parentNamespace}.${configurationNamespace}` : configurationNamespace;
		return new Configuration(subDict, parentNamespace);
	}

	public get(key: string): boolean | number | string {
		if (!key) { throw new ArgumentError("key"); }
		if (key in this._dict) {
			const value = this._dict[key];
			return value;
		}
		throwWrongKeyError(key, this._parentNamespace);
	}

	public getBase64(key: string, defaultValue?: Uint8Array): Uint8Array {
		if (!key) { throw new ArgumentError("key"); }
		if (key in this._dict) {
			const value = this._dict[key];
			const parsedData = Buffer.from(value, "base64");
			const restoredValue = parsedData.toString("base64");
			if (restoredValue !== value) {
				const partOfValue = value.slice(0, 4);
				const maskValue = `${partOfValue}...`;
				const fullKeyName = this.getFullKey(key);
				throw new ConfigurationError(
					`Bad type of key '${fullKeyName}'. Cannot parse value '${maskValue}' as base64.`,
					fullKeyName, null
				);
			}
			return parsedData;
		}
		if (defaultValue !== undefined) { return defaultValue; }
		throwWrongKeyError(key, this._parentNamespace);
	}

	public getBoolean(key: string, defaultValue?: boolean): boolean {
		if (!key) { throw new ArgumentError("key"); }
		if (key in this._dict) {
			const value = this._dict[key];
			if (value === "true") { return true; }
			if (value === "false") { return false; }
			const fullKeyName = this.getFullKey(key);
			throw new ConfigurationError(
				`Bad type of key '${fullKeyName}'. Cannot convert the value '${value}' to boolean type.`,
				fullKeyName, null
			);
		}
		if (defaultValue !== undefined) { return defaultValue; }
		throwWrongKeyError(key, this._parentNamespace);
	}

	public getInteger(key: string, defaultValue?: number): number {
		if (!key) { throw new ArgumentError("key"); }
		if (key in this._dict) {
			const value = this._dict[key];
			const friendlyValue = parseInt(value);
			if (friendlyValue.toString() === value) { return friendlyValue; }
			const fullKeyName = this.getFullKey(key);
			throw new ConfigurationError(
				`Bad type of key '${fullKeyName}'. Cannot convert the value '${value}' to integer type.`,
				fullKeyName, null
			);
		}
		if (defaultValue !== undefined) { return defaultValue; }
		throwWrongKeyError(key, this._parentNamespace);
	}

	public getFloat(key: string, defaultValue?: number): number {
		if (!key) { throw new ArgumentError("key"); }
		if (key in this._dict) {
			const value = this._dict[key];
			const friendlyValue = parseFloat(value);
			if (friendlyValue.toString() === value) { return friendlyValue; }
			const fullKeyName = this.getFullKey(key);
			throw new ConfigurationError(
				`Bad type of key '${fullKeyName}'. Cannot convert the value '${value}' to float type.`,
				fullKeyName, null
			);
		}
		if (defaultValue !== undefined) { return defaultValue; }
		throwWrongKeyError(key, this._parentNamespace);
	}

	public getEnabled(key: string, defaultValue?: boolean): boolean {
		if (!key) { throw new ArgumentError("key"); }
		if (key in this._dict) {
			const value = this._dict[key];
			if (value === "enabled") { return true; }
			if (value === "disabled") { return false; }
			const fullKeyName = this.getFullKey(key);
			throw new ConfigurationError(
				`Bad type of key '${fullKeyName}'. Cannot convert the value '${value}' to enabled boolean value.`,
				fullKeyName, null
			);
		}
		if (defaultValue !== undefined) { return defaultValue; }
		throwWrongKeyError(key, this._parentNamespace);
	}

	public getString(key: string, defaultValue?: string): string {
		if (!key) { throw new ArgumentError("key"); }
		if (key in this._dict) { return this._dict[key]; }
		if (defaultValue !== undefined) { return defaultValue; }
		throwWrongKeyError(key, this._parentNamespace);
	}

	public getURL(key: string, defaultValue?: URL): URL {
		if (!key) { throw new ArgumentError("key"); }
		if (key in this._dict) {
			const value = this._dict[key];
			try {
				return new URL(value);
			} catch (e) {
				const partOfValue = value.slice(0, 4);
				const maskValue = `${partOfValue}...`;
				const fullKeyName = this.getFullKey(key);
				throw new ConfigurationError(`Bad type of key '${fullKeyName}'. Cannot parse value '${maskValue}' as URL.`, fullKeyName, e);
			}
		}
		if (defaultValue !== undefined) { return defaultValue; }
		throwWrongKeyError(key, this._parentNamespace);
	}

	public has(key: string): boolean {
		if (!key) { throw new ArgumentError("key"); }
		return key in this._dict;
	}

	public hasNamespace(configurationNamespace: string): boolean {
		const criteria = configurationNamespace + ".";
		const criteriaLen = criteria.length;
		for (const key of Object.keys(this._dict)) {
			if (key.length > criteriaLen && key.startsWith(criteria)) {
				return true;
			}
		}
		return false;
	}

	public hasNonEmpty(key: string): boolean {
		if (!key) { throw new ArgumentError("key"); }
		if (key in this._dict) {
			const value = this._dict[key];
			return !_.isEmpty(value);
		}
		return false;
	}

	public keys(): ReadonlyArray<string> {
		return Object.keys(this._dict);
	}

	private getFullKey(key: string): string {
		if (this._parentNamespace !== undefined) {
			return `${this._parentNamespace}.${key}`;
		}
		return key;
	}
}


/*==========*/
/* INTERNAL */
/*==========*/
function propertiesFileContentProcessor(file: string, cb: (name: string, value: string) => void): void {
	const fileContent = fs.readFileSync(file);
	const lines = fileContent.toString().split(/(?:\r\n|\r|\n)/g);
	lines.forEach((line) => {
		if (line.startsWith("#")) { return; }
		const indexOfEq = line.indexOf("=");
		if (indexOfEq >= 0) {
			const name: string = line.substr(0, indexOfEq).trim();
			const value: string = line.substr(indexOfEq + 1).trim();
			cb(name, value);
		}
	});
}

function throwWrongKeyError(key: string, parentNamespace?: string): never {
	if (parentNamespace !== undefined) {
		const fullKey: string = `${parentNamespace}.${key}`;
		throw new ConfigurationError(
			`A value for key '${fullKey}' was not found in current configuration.`,
			fullKey, null
		);
	}
	throw new ConfigurationError(
		`A value for key '${key}' was not found in current configuration.`,
		key, null
	);
}
