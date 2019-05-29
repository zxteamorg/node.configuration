import * as zxteam from "@zxteam/contract";
import * as _ from "lodash";
import * as path from "path";
import * as fs from "fs";
import * as username from "username";

export function chain(...configurations: ReadonlyArray<zxteam.Configuration>): zxteam.Configuration {
	const items = configurations.slice();
	function binder(method: keyof zxteam.Configuration): (key: string, defaultValue?: any) => any {
		function bind(key: string, defaultValue?: any) {
			for (let itemIndex = 0; itemIndex < items.length; ++itemIndex) {
				const configurationItem: zxteam.Configuration = items[itemIndex];
				if (configurationItem.hasKey(key)) { return configurationItem[method](key); }
			}
			if (defaultValue !== undefined) { return defaultValue; }
			throw new Error("A value for key '" + key + "' was not found in current confugration.");
		}
		return bind;
	}
	const chainConfiguration: zxteam.Configuration = {
		getBoolean: binder("getBoolean"),
		getConfiguration(configurationNamespace: string): zxteam.Configuration {
			return chain(...items.map(item => item.getConfiguration(configurationNamespace)));
		},
		getEnabled: binder("getEnabled"),
		getFloat: binder("getFloat"),
		getInt: binder("getInt"),
		getObject: binder("getObject"),
		getString: binder("getString"),
		hasKey(key: string): boolean {
			for (let itemIndex = 0; itemIndex < items.length; ++itemIndex) {
				if (items[itemIndex].hasKey(key)) { return true; }
			}
			return false;
		}
	};
	return chainConfiguration;
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

	public constructor(dict: ConfigurationDictionary) { this._dict = dict; }

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
		return new Configuration(subDict);
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
		throw new Error("A value for key '" + key + "' was not found in current confugration.");
	}

	public getInt(key: string, defaultValue?: number): number {
		if (!key) { throw new ArgumentException("key"); }
		if (key in this._dict) {
			const value = this._dict[key];
			const friendlyValue = parseInt(value);
			if (friendlyValue.toString() === value) { return friendlyValue; }
			throw new Error("Bad type of key '" + key + "'. Cannot convert the value '"
				+ value + "' to integer type.");
		}
		if (defaultValue !== undefined) { return defaultValue; }
		throw new Error("A value for key '" + key + "' was not found in current confugration.");
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
		throw new Error("A value for key '" + key + "' was not found in current confugration.");
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
		throw new Error("A value for key '" + key + "' was not found in current confugration.");
	}

	public getObject(key: string, defaultValue?: any): any {
		throw new Error("Not implemented yet.");
	}

	public getString(key: string, defaultValue?: string): string {
		if (!key) { throw new ArgumentException("key"); }
		if (key in this._dict) { return this._dict[key]; }
		if (defaultValue !== undefined) { return defaultValue; }
		throw new Error("A value for key '" + key + "' was not found in current confugration.");
	}

	public hasKey(key: string): boolean {
		if (!key) { throw new ArgumentException("key"); }
		return key in this._dict;
	}
}


class ArgumentException extends Error implements zxteam.ArgumentError {
	public readonly name = "ArgumentError";
}

