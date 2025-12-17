/**
 * Parser for map/dictionary JSON format.
 * 
 * Expected formats:
 * {
 *   "path/to/note1.md": [0.1, 0.2, ...],
 *   "path/to/note2.md": [0.3, 0.4, ...],
 *   ...
 * }
 */

import type { EmbeddingParser, ParseResult, EmbeddingEntry } from "./types";

/**
 * Converts an array-like value to Float32Array.
 */
function toFloat32Array(value: unknown): Float32Array | null {
	if (!Array.isArray(value)) {
		return null;
	}
	
	// Check if all elements are numbers
	if (!value.every((v) => typeof v === "number")) {
		return null;
	}
	
	return new Float32Array(value);
}

/**
 * Normalizes a file path for consistent lookup.
 */
function normalizePath(path: string): string {
	// Replace backslashes with forward slashes
	let normalized = path.replace(/\\/g, "/");
	
	// Remove leading slash if present
	if (normalized.startsWith("/")) {
		normalized = normalized.substring(1);
	}
	
	// Remove trailing slash if present
	if (normalized.endsWith("/")) {
		normalized = normalized.substring(0, normalized.length - 1);
	}
	
	return normalized;
}

/**
 * Parser for path -> embedding map format.
 */
export class MapParser implements EmbeddingParser {
	readonly name = "Map (path -> embedding)";
	
	parse(data: unknown): ParseResult | null {
		if (typeof data !== "object" || data === null || Array.isArray(data)) {
			return null;
		}
		
		const obj = data as Record<string, unknown>;
		const keys = Object.keys(obj);
		
		if (keys.length === 0) {
			return {
				entries: [],
				errorCount: 0,
				formatDescription: "Empty map",
			};
		}
		
		// Check if values look like embedding arrays
		const firstValue = obj[keys[0]];
		if (!Array.isArray(firstValue)) {
			// Might be a different object format, let other parsers try
			return null;
		}
		
		// Check if first array element is a number (looks like embedding)
		if (firstValue.length === 0 || typeof firstValue[0] !== "number") {
			return null;
		}
		
		const entries: EmbeddingEntry[] = [];
		let errorCount = 0;
		
		for (const [key, value] of Object.entries(obj)) {
			const vector = toFloat32Array(value);
			if (!vector) {
				errorCount++;
				continue;
			}
			
			entries.push({
				path: normalizePath(key),
				vector,
			});
		}
		
		if (entries.length === 0) {
			return null;
		}
		
		return {
			entries,
			errorCount,
			formatDescription: `Map with ${keys.length} entries`,
		};
	}
}

