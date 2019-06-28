import * as zxteam from "@zxteam/contract";

import { assert } from "chai";

import * as thislib from "../src";

describe("chainConfiguration tests", function () {
	const fakeConfguraton0: zxteam.Configuration = {
		get(key: string) { throw new Error(); },
		getBoolean(key: string, defaultValue?: boolean): boolean { throw new Error(); },
		getConfiguration(configurationNamespace: string): zxteam.Configuration { throw new Error(); },
		getEnabled(key: string, defaultValue?: boolean): boolean { throw new Error(); },
		getFloat(key: string, defaultValue?: number): number { if (key === "ageFloat") { return 0; } throw new Error(); },
		getInteger(key: string, defaultValue?: number): number { if (key === "ageInt") { return 0; } throw new Error(); },
		getString(key: string, defaultValue?: string): string { if (key === "ageString") { return "0"; } throw new Error(); },
		hasKey(key: string): boolean { return ["ageString", "ageInt", "ageFloat"].includes(key); },
		keys() { return ["ageString", "ageInt", "ageFloat"]; }
	};
	const fakeConfguraton1: zxteam.Configuration = {
		get(key: string) { throw new Error(); },
		getBoolean(key: string, defaultValue?: boolean): boolean { throw new Error(); },
		getConfiguration(configurationNamespace: string): zxteam.Configuration { throw new Error(); },
		getEnabled(key: string, defaultValue?: boolean): boolean { throw new Error(); },
		getFloat(key: string, defaultValue?: number): number { throw new Error(); },
		getInteger(key: string, defaultValue?: number): number { if (key === "ageInt") { return 1; } throw new Error(); },
		getString(key: string, defaultValue?: string): string { if (key === "ageString") { return "1"; } throw new Error(); },
		hasKey(key: string): boolean { return ["ageString", "ageInt"].includes(key); },
		keys() { return ["ageInt", "ageString"]; }
	};
	const fakeConfguraton2: zxteam.Configuration = {
		get(key: string) { throw new Error(); },
		getBoolean(key: string, defaultValue?: boolean): boolean { throw new Error(); },
		getConfiguration(configurationNamespace: string): zxteam.Configuration { throw new Error(); },
		getEnabled(key: string, defaultValue?: boolean): boolean { throw new Error(); },
		getFloat(key: string, defaultValue?: number): number { throw new Error(); },
		getInteger(key: string, defaultValue?: number): number { throw new Error(); },
		getString(key: string, defaultValue?: string): string { if (key === "ageString") { return "2"; } throw new Error(); },
		hasKey(key: string): boolean { return ["ageString"].includes(key); },
		keys() { return ["ageString"]; }
	};

	it("Generic test", function () {
		const chain = thislib.chainConfiguration(fakeConfguraton2, fakeConfguraton1, fakeConfguraton0);
		assert.equal(chain.getString("ageString"), "2", "Shold take value from fakeConfguraton2");
		assert.equal(chain.getInteger("ageInt"), 1, "Shold take value from fakeConfguraton1");
		assert.equal(chain.getFloat("ageFloat"), 0, "Shold take value from fakeConfguraton0");
	});
});
