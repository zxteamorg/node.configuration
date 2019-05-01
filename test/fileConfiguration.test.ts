import { assert } from "chai";

import * as path from "path";
import * as fs from "fs";
import * as tmp from "tmp";
import * as username from "username";

import * as thislib from "../src";

describe("Development configuration test", function () {
	let tempDirectoryObj: tmp.DirResult;
	before(() => {
		// runs before all tests in this block
		tempDirectoryObj = tmp.dirSync();
		const currentUserName = username.sync();
		const projectConfigDir = path.join(tempDirectoryObj.name, "project.properties");
		const userConfigDir = path.join(tempDirectoryObj.name, "user.properties");
		fs.mkdirSync(projectConfigDir);
		fs.mkdirSync(userConfigDir);
		fs.writeFileSync(
			path.join(projectConfigDir, "config.properties"),
			"# Test config file \r\n" +
			"a.a.a = project-root-a\r\n" +
			"a.a.b = project-root-b\r\n" +
			"a.a.c = project-root-c\r\n" +
			"a.a.d = project-root-d\r\n"
		);
		fs.writeFileSync(
			path.join(projectConfigDir, "config-DEVEL.properties"),
			"# Test config file \r\n" +
			"a.a.b = project-site-b\r\n" +
			"a.a.c = project-site-c\r\n" +
			"a.a.d = project-site-d\r\n"
		);
		fs.writeFileSync(
			path.join(userConfigDir, "config-" + currentUserName + ".properties"),
			"# Test config file \r\n" +
			"a.a.d = user-own-d\r\n"
		);
	});
	after(() => {
		//tempDirectoryObj.removeCallback();
	});

	beforeEach(() => {
		delete process.env["a.a.a"];
		delete process.env["a.a.b"];
		delete process.env["a.a.c"];
		delete process.env["a.a.d"];
	});

	it("Site's and user's values should override Devel Virtual Files Configuration", function () {
		const config = thislib.develVirtualFilesConfiguration(tempDirectoryObj.name, "DEVEL");
		assert.equal(config.getString("a.a.a"), "project-root-a");
		assert.equal(config.getString("a.a.b"), "project-site-b"); // Site's value
		assert.equal(config.getString("a.a.d"), "user-own-d"); // User's value
	});

	it("Environment variables should override Devel Virtual Files Configuration", function () {
		process.env["a.a.a"] = "env-own-a";
		process.env["a.a.b"] = "env-own-b";
		process.env["a.a.c"] = "env-own-c";
		process.env["a.a.d"] = "env-own-d";
		const config = thislib.develVirtualFilesConfiguration(tempDirectoryObj.name, "DEVEL");
		assert.equal(config.getString("a.a.a"), "env-own-a");
		assert.equal(config.getString("a.a.b"), "env-own-b");
		assert.equal(config.getString("a.a.c"), "env-own-c");
		assert.equal(config.getString("a.a.d"), "env-own-d");
	});

	it("Environment variables should NOT override File Configuration", function () {
		process.env["a.a.a"] = "env-own-a";
		process.env["a.a.b"] = "env-own-b";
		process.env["a.a.c"] = "env-own-c";
		process.env["a.a.d"] = "env-own-d";
		const config = thislib.fileConfiguration(path.join(tempDirectoryObj.name, "project.properties", "config.properties"));
		assert.equal(config.getString("a.a.a"), "project-root-a");
		assert.equal(config.getString("a.a.b"), "project-root-b");
		assert.equal(config.getString("a.a.c"), "project-root-c");
		assert.equal(config.getString("a.a.d"), "project-root-d");
	});

	it("File Configuration should be namespace-able", function () {
		const config = thislib.fileConfiguration(path.join(tempDirectoryObj.name, "project.properties", "config.properties"));
		const nsConfig1 = config.getConfiguration("a");
		assert.equal(nsConfig1.getString("a.a"), "project-root-a");
		assert.equal(nsConfig1.getString("a.b"), "project-root-b");
		assert.equal(nsConfig1.getString("a.c"), "project-root-c");
		assert.equal(nsConfig1.getString("a.d"), "project-root-d");
		const nsConfig1_2 = nsConfig1.getConfiguration("a");
		assert.equal(nsConfig1_2.getString("a"), "project-root-a");
		assert.equal(nsConfig1_2.getString("b"), "project-root-b");
		assert.equal(nsConfig1_2.getString("c"), "project-root-c");
		assert.equal(nsConfig1_2.getString("d"), "project-root-d");
		const nsConfig2 = config.getConfiguration("a.a");
		assert.equal(nsConfig2.getString("a"), "project-root-a");
		assert.equal(nsConfig2.getString("b"), "project-root-b");
		assert.equal(nsConfig2.getString("c"), "project-root-c");
		assert.equal(nsConfig2.getString("d"), "project-root-d");
	});

	it("Devel Virtual Files Configuration should be namespace-able", function () {
		const config = thislib.develVirtualFilesConfiguration(tempDirectoryObj.name, "DEVEL");
		const nsConfig1 = config.getConfiguration("a");
		assert.equal(nsConfig1.getString("a.a"), "project-root-a");
		assert.equal(nsConfig1.getString("a.b"), "project-site-b"); // Site's value
		assert.equal(nsConfig1.getString("a.d"), "user-own-d"); // User's value
		const nsConfig1_2 = nsConfig1.getConfiguration("a");
		assert.equal(nsConfig1_2.getString("a"), "project-root-a");
		assert.equal(nsConfig1_2.getString("b"), "project-site-b"); // Site's value
		assert.equal(nsConfig1_2.getString("d"), "user-own-d"); // User's value
		const nsConfig2 = config.getConfiguration("a.a");
		assert.equal(nsConfig2.getString("a"), "project-root-a");
		assert.equal(nsConfig2.getString("b"), "project-site-b"); // Site's value
		assert.equal(nsConfig2.getString("d"), "user-own-d"); // User's value
	});
});

