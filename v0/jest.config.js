module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	roots: ["<rootDir>/src", "<rootDir>/test"],
	testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
	transform: {
		"^.+\\.ts$": "ts-jest",
	},
	collectCoverageFrom: [
		"src/**/*.ts",
		"!src/**/*.d.ts",
		"!src/**/__tests__/**",
		"!src/ui/**",
		"!src/types/**",
	],
	coverageDirectory: "coverage",
	coverageReporters: ["text", "lcov", "html"],
	coverageThreshold: {
		global: {
			branches: 60,
			functions: 70,
			lines: 70,
			statements: 70,
		},
	},
	moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/src/$1",
		"^obsidian$": "<rootDir>/test/__mocks__/obsidian.ts",
		"^uuid$": "<rootDir>/test/__mocks__/uuid.ts",
	},
	globals: {
		"ts-jest": {
			tsconfig: {
				esModuleInterop: true,
				allowSyntheticDefaultImports: true,
			},
		},
	},
};
