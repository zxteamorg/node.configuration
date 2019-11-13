import * as zxteam from "@zxteam/contract";

import { assert } from "chai";

import * as thislib from "../src";

describe("chainConfiguration tests", function () {
	it("Generic test", function () {
		const fakeConfguraton0: zxteam.Configuration = {
			get(key: string) { throw new Error(); },
			getBase64(key: string) { throw new Error(); },
			getBoolean(key: string, defaultValue?: boolean): boolean { throw new Error(); },
			getConfiguration(configurationNamespace: string): zxteam.Configuration { throw new Error(); },
			getEnabled(key: string, defaultValue?: boolean): boolean { throw new Error(); },
			getFloat(key: string, defaultValue?: number): number { if (key === "ageFloat") { return 0; } throw new Error(); },
			getInteger(key: string, defaultValue?: number): number { if (key === "ageInt") { return 0; } throw new Error(); },
			getString(key: string, defaultValue?: string): string { if (key === "ageString") { return "0"; } throw new Error(); },
			getURL(key: string) { throw new Error(); },
			has(key: string): boolean { return ["ageString", "ageInt", "ageFloat"].includes(key); },
			hasNamespace(configurationNamespace: string): boolean { throw new Error(); },
			hasNonEmpty(key: string): boolean { throw new Error(); },
			keys() { return ["ageString", "ageInt", "ageFloat"]; }
		};
		const fakeConfguraton1: zxteam.Configuration = {
			get(key: string) { throw new Error(); },
			getBase64(key: string) { throw new Error(); },
			getBoolean(key: string, defaultValue?: boolean): boolean { throw new Error(); },
			getConfiguration(configurationNamespace: string): zxteam.Configuration { throw new Error(); },
			getEnabled(key: string, defaultValue?: boolean): boolean { throw new Error(); },
			getFloat(key: string, defaultValue?: number): number { throw new Error(); },
			getInteger(key: string, defaultValue?: number): number { if (key === "ageInt") { return 1; } throw new Error(); },
			getString(key: string, defaultValue?: string): string { if (key === "ageString") { return "1"; } throw new Error(); },
			getURL(key: string) { throw new Error(); },
			has(key: string): boolean { return ["ageString", "ageInt"].includes(key); },
			hasNamespace(configurationNamespace: string): boolean { throw new Error(); },
			hasNonEmpty(key: string): boolean { return fakeConfguraton1.has(key); },
			keys() { return ["ageInt", "ageString"]; }
		};
		const fakeConfguraton2: zxteam.Configuration = {
			get(key: string) { throw new Error(); },
			getBase64(key: string) { throw new Error(); },
			getBoolean(key: string, defaultValue?: boolean): boolean { throw new Error(); },
			getConfiguration(configurationNamespace: string): zxteam.Configuration { throw new Error(); },
			getEnabled(key: string, defaultValue?: boolean): boolean { throw new Error(); },
			getFloat(key: string, defaultValue?: number): number { throw new Error(); },
			getInteger(key: string, defaultValue?: number): number { throw new Error(); },
			getString(key: string, defaultValue?: string): string { if (key === "ageString") { return "2"; } throw new Error(); },
			getURL(key: string) { throw new Error(); },
			has(key: string): boolean { return ["ageString"].includes(key); },
			hasNamespace(configurationNamespace: string): boolean { throw new Error(); },
			hasNonEmpty(key: string): boolean { return fakeConfguraton2.has(key); },
			keys() { return ["ageString"]; }
		};

		const chain = thislib.chainConfiguration(fakeConfguraton2, fakeConfguraton1, fakeConfguraton0);
		assert.equal(chain.getString("ageString"), "2", "Should take value from fakeConfguraton2");
		assert.equal(chain.getInteger("ageInt"), 1, "Should take value from fakeConfguraton1");
		assert.equal(chain.getFloat("ageFloat"), 0, "Should take value from fakeConfguraton0");
	});


	it("issues/1", function () {
		const commonConfig: any = {
			getInteger(key: string, defaultValue?: number): number {
				if (key === "boo") {
					return 12;
				} else if (key === "foo") {
					return 42;
				}
				throw new Error();
			},
			has(key: string): boolean { return ["boo", "foo"].includes(key); },
			hasNonEmpty(key: string): boolean { return commonConfig.has(key); },
			keys() { return ["boo", "foo"]; }
		};

		const overrideConfig: any = {
			getString(key: string, defaultValue?: number): string {
				if (key === "foo") {
					return "";
				}
				throw new Error();
			},
			has(key: string): boolean { return ["foo"].includes(key); },
			hasNonEmpty(key: string): boolean { return false; /* foo is empty */ },
			keys() { return ["foo"]; }
		};

		const chain = thislib.chainConfiguration(overrideConfig, commonConfig);
		assert.equal(chain.getInteger("boo"), 12, "Should take value from commonConfig");
		assert.isTrue(chain.has("foo"));
		assert.isFalse(chain.hasNonEmpty("foo"));
		assert.equal(chain.getString("foo"), "", "Should take empty value from overrideConfig");
	});

	it("Bug: 6.0.33", function () {
		const cfg1  = new thislib.Configuration({
			"bla": "bla"
		});
		const cfg2  = new thislib.Configuration({
			"endpoint.0.type": "rest",
			"endpoint.0.servers": "main",
			"endpoint.0.bindPath": "/",
			"endpoints": "0"
		});

		const chainConfiguration = thislib.chainConfiguration(cfg1, cfg2);
		assert.isObject(chainConfiguration);

		const endpointsConfiguration = chainConfiguration.getString("endpoints");
		assert.equal(endpointsConfiguration, "0");

		const endpointConfiguration = chainConfiguration.getConfiguration(`endpoint.0`);
		assert.isObject(endpointConfiguration);
		assert.equal(endpointConfiguration.getString("type"), "rest");
		assert.equal(endpointConfiguration.getString("servers"), "main");
		assert.equal(endpointConfiguration.getString("bindPath"), "/");
	});

});
