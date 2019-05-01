import * as assert from "assert";

import * as zxteam from "@zxteam/contract";

describe("Stub", function () {
	it("Should be equal 42 to 42", function () {
		const a: zxteam.Disposable = {
			dispose() { throw new Error("Just test that @zxteam/contract is resolved"); }
		};

		assert.equal(42, 42);
	});
});
