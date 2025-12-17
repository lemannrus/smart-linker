/**
 * Parser for array-of-objects JSON format.
 * 
 * Expected formats:
 * [
 *   { "path": "...", "embedding": [...] },
 *   { "file": "...", "vector": [...] },
 *   etc.
 * ]
 */

import type { EmbeddingParser, ParseResult, ManualMappingConfig, EmbeddingEntry } from "./types";

/** Common keys that might contain the file path */
const PATH_KEYS = ["path", "file", "filepath", "filePath", "notePath", "note_path", "name"];

/** Common keys that might contain the embedding vector */
const EMBEDDING_KEYS = ["embedding", "vector", "values", "embeddings", "vec", "emb"];

/**
 * Tries to find a value in an object using multiple possible keys.
 */
function findValue(obj: Record<string, unknown>, keys: string[]): unknown {
	for (const key of keys) {
		if (key in obj) {
			return obj[key];
		}
	}
	return undefined;
}

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
 * Parser for array-of-objects format.
 */
export class ArrayParser implements EmbeddingParser {
	readonly name = "Array of objects";
	
	parse(data: unknown, config?: ManualMappingConfig): ParseResult | null {
		if (!Array.isArray(data)) {
			return null;
		}
		
		if (data.length === 0) {
			return {
				entries: [],
				errorCount: 0,
				formatDescription: "Empty array",
			};
		}
		
		// Check if first element looks like an object with expected fields
		const first = data[0];
		if (typeof first !== "object" || first === null) {
			return null;
		}
		
		const entries: EmbeddingEntry[] = [];
		let errorCount = 0;
		
		// Determine keys to use
		const pathKeys = config?.pathKey ? [config.pathKey] : PATH_KEYS;
		const embeddingKeys = config?.embeddingKey ? [config.embeddingKey] : EMBEDDING_KEYS;
		
		for (const item of data) {
			if (typeof item !== "object" || item === null) {
				errorCount++;
				continue;
			}
			
			const obj = item as Record<string, unknown>;
			const path = findValue(obj, pathKeys);
			const embedding = findValue(obj, embeddingKeys);
			
			if (typeof path !== "string" || !path) {
				errorCount++;
				continue;
			}
			
			const vector = toFloat32Array(embedding);
			if (!vector) {
				errorCount++;
				continue;
			}
			
			entries.push({
				path: normalizePath(path),
				vector,
			});
		}
		
		if (entries.length === 0 && errorCount === data.length) {
			// Couldn't parse any entries - format probably not recognized
			return null;
		}
		
		return {
			entries,
			errorCount,
			formatDescription: `Array of ${data.length} objects`,
		};
	}
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

