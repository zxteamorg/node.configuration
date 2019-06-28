import * as zxteam from "@zxteam/contract";
import * as _ from "lodash";
import * as path from "path";
import * as fs from "fs";
import * as username from "username";

import { promisify } from "util";

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export function chainConfiguration(...configurations: ReadonlyArray<zxteam.Configuration>): zxteam.Configuration {
	const items = configurations.slice();
	function binder(method: keyof zxteam.Configuration): (key: string, defaultValue?: any) => any {
		function bind(key: string, defaultValue?: any) {
			for (let itemIndex = 0; itemIndex < items.length; ++itemIndex) {
				const configurationItem: zxteam.Configuration = items[itemIndex];
				if (configurationItem.hasKey(key)) { return configurationItem[method](key); }
			}
			if (defaultValue !== undefined) { return defaultValue; }
			throw new Error("A value for key '" + key + "' was not found in current configuration.");
		}
		return bind;
	}
	const chainConfigurationInstance: zxteam.Configuration = {
		get: binder("get"),
		getBoolean: binder("getBoolean"),
		getConfiguration(configurationNamespace: string): zxteam.Configuration {
			return chainConfiguration(...items.map(item => item.getConfiguration(configurationNamespace)));
		},
		getEnabled: binder("getEnabled"),
		getFloat: binder("getFloat"),
		getInteger: binder("getInteger"),
		getString: binder("getString"),
		hasKey(key: string): boolean {
			for (let itemIndex = 0; itemIndex < items.length; ++itemIndex) {
				if (items[itemIndex].hasKey(key)) { return true; }
			}
			return false;
		},
		keys() { return _.union(...items.map(item => Object.keys(item))); }
	};
	return chainConfigurationInstance;
}
export function fileConfiguration(configFile: string): zxteam.Configuration {
	const dict: ConfigurationDictionary = {};
	propertiesFileContentProcessor(configFile, (name: string, value: string) => {
		dict[name] = value;
	});
	return new Configuration(dict);
}
export function envConfiguration(): zxteam.Configuration {
	const dict: ConfigurationDictionary = {};
	_.entries(process.env).forEach(([name, value]) => {
		if (value !== undefined) {
			dict[name] = value;
		}
	});
	return new Configuration(dict);
}
export function cmdConfiguration(): zxteam.Configuration {
	//TODO
	throw new Error("Not implemented yet");
}
export async function swarmSecretsConfiguration(directory?: string): Promise<zxteam.Configuration> {
	if (directory === undefined) {
		// Setup default dir
		// https://docs.docker.com/engine/swarm/secrets/
		directory = "/run/secrets";
	}

	const dict: ConfigurationDictionary = {};
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
export function develVirtualFilesConfiguration(configDir: string, develSite: string): zxteam.Configuration {
	if (!configDir) { throw new ArgumentException("configDir"); }
	if (!fs.existsSync(configDir)) { throw new Error("Bad configuration directory (not exists): " + configDir); }
	const projectConfigDir = path.join(configDir, "project.properties");

	const files: Array<string> = [];
	files.push(path.join(projectConfigDir, "config.properties"));
	files.push(path.join(projectConfigDir, "config-" + develSite + ".properties"));
	const userConfigDir = path.join(configDir, "user.properties");
	const currentUserName = username.sync();
	if (currentUserName) {
		files.push(path.join(userConfigDir, "config-" + currentUserName + ".properties"));
	}

	const dict: ConfigurationDictionary = {};
	files.forEach((file) => {
		if (!fs.existsSync(file)) {
			console.warn("Skip a configuration file (not exists): " + file);
			throw new Error("Skip a configuration file(not exists): " + file);
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

/*==========*/
/* INTERNAL */
/*==========*/
type ConfigurationDictionary = { [key: string]: string };

class Configuration implements zxteam.Configuration {
	private readonly _dict: ConfigurationDictionary;
	private readonly _parentNamespace?: string;

	public constructor(dict: ConfigurationDictionary, parentNamespace?: string) {
		this._dict = dict;
		if (parentNamespace !== undefined) {
			this._parentNamespace = parentNamespace;
		}
	}

	public getConfiguration(configurationNamespace: string): zxteam.Configuration {
		if (!configurationNamespace) { throw new ArgumentException("configurationNamespace"); }
		const subDict: ConfigurationDictionary = {};
		const criteria = configurationNamespace + ".";
		const criteriaLen = criteria.length;
		Object.keys(this._dict).forEach((key) => {
			if (key.length > criteriaLen && key.startsWith(criteria)) {
				const value = this._dict[key];
				subDict[key.substring(criteriaLen)] = value;
			}
		});
		return new Configuration(subDict, configurationNamespace);
	}

	public get(key: string): boolean | number | string {
		if (!key) { throw new ArgumentException("key"); }
		if (key in this._dict) {
			const value = this._dict[key];
			return value;
		}
		throw new Error(this.generateWrongKeyErrorMessage(key));
	}

	public getBoolean(key: string, defaultValue?: boolean): boolean {
		if (!key) { throw new ArgumentException("key"); }
		if (key in this._dict) {
			const value = this._dict[key];
			if (value === "true") { return true; }
			if (value === "false") { return false; }
			throw new Error("Bad type of key '" + key + "'. Cannot convert the value '"
				+ value + "' to boolean type.");
		}
		if (defaultValue !== undefined) { return defaultValue; }
		throw new Error(this.generateWrongKeyErrorMessage(key));
	}

	public getInteger(key: string, defaultValue?: number): number {
		if (!key) { throw new ArgumentException("key"); }
		if (key in this._dict) {
			const value = this._dict[key];
			const friendlyValue = parseInt(value);
			if (friendlyValue.toString() === value) { return friendlyValue; }
			throw new Error("Bad type of key '" + key + "'. Cannot convert the value '"
				+ value + "' to integer type.");
		}
		if (defaultValue !== undefined) { return defaultValue; }
		throw new Error(this.generateWrongKeyErrorMessage(key));
	}

	public getFloat(key: string, defaultValue?: number): number {
		if (!key) { throw new ArgumentException("key"); }
		if (key in this._dict) {
			const value = this._dict[key];
			const friendlyValue = parseFloat(value);
			if (friendlyValue.toString() === value) { return friendlyValue; }
			throw new Error("Bad type of key '" + key + "'. Cannot convert the value '"
				+ value + "' to float type.");
		}
		if (defaultValue !== undefined) { return defaultValue; }
		throw new Error(this.generateWrongKeyErrorMessage(key));
	}

	public getEnabled(key: string, defaultValue?: boolean): boolean {
		if (!key) { throw new ArgumentException("key"); }
		if (key in this._dict) {
			const value = this._dict[key];
			if (value === "enabled") { return true; }
			if (value === "disabled") { return false; }
			throw new Error("Bad type of key '" + key + "'. Cannot convert the value '"
				+ value + "' to enabled boolean value.");
		}
		if (defaultValue !== undefined) { return defaultValue; }
		throw new Error(this.generateWrongKeyErrorMessage(key));
	}

	public getString(key: string, defaultValue?: string): string {
		if (!key) { throw new ArgumentException("key"); }
		if (key in this._dict) { return this._dict[key]; }
		if (defaultValue !== undefined) { return defaultValue; }
		throw new Error(this.generateWrongKeyErrorMessage(key));
	}

	public hasKey(key: string): boolean {
		if (!key) { throw new ArgumentException("key"); }
		return key in this._dict;
	}

	public keys(): ReadonlyArray<string> {
		return Object.keys(this._dict);
	}

	private generateWrongKeyErrorMessage(key: string): string {
		if (this._parentNamespace !== undefined) {
			return `A value for key '${this._parentNamespace}.${key}' was not found in current configuration.`;
		}
		return `A value for key '${key}' was not found in current configuration.`;
	}
}


class ArgumentException extends Error implements zxteam.ArgumentError {
	public readonly name = "ArgumentError";
}

