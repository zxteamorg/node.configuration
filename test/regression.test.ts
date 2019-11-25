import { assert } from "chai";

import { Configuration, chainConfiguration } from "../src";

describe("Regression tests", function () {
	it("Method key() should works for sub-configuration (bug in 6.0.23)", function () {
		const config1: Configuration = new Configuration({
			"a.b1": "b1value",
			"a.b2": "b2value"
		});
		const config2: Configuration = new Configuration({
			"a.b1": "b1valueOverride",
			"a.b3": "b3value"
		});

		const config = chainConfiguration(config2, config1);

		{ // Root keys
			const keys = [...config.keys()];
			assert.isArray(keys);
			assert.equal(keys.length, 3);
			keys.sort();
			assert.equal(keys[0], "a.b1");
			assert.equal(keys[1], "a.b2");
			assert.equal(keys[2], "a.b3");
		}

		{ // sub keys
			const keys = [...config.getConfiguration("a").keys()];
			assert.isArray(keys);
			assert.equal(keys.length, 3);
			keys.sort();
			assert.equal(keys[0], "b1");
			assert.equal(keys[1], "b2");
			assert.equal(keys[2], "b3");
		}
	});

	it.only("Method getURL() should raise error with full key name for sub-configuration (bug in 6.0.36)", function () {
		const config1: Configuration = new Configuration({
			"a.url": "http://localhost:9090"
		});
		const config2: Configuration = new Configuration({
			"a.url": "http://localhost:8080"
		});

		const config = chainConfiguration(config2, config1);
		const subConfig = config.getConfiguration("a");

		let expectedError!: Error;
		try {
			subConfig.getURL("wrongKey");
		} catch (e) {
			expectedError = e;
		}

		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, Error);

		assert.include(expectedError.message, "a.wrongKey");
	});
});
