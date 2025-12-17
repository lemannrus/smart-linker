/**
 * Parser for vector-search plugin JSON format.
 * 
 * Expected format:
 * {
 *   "ollamaURL": "...",
 *   "modelName": "...",
 *   "vectors": [
 *     { "path": "...", "embedding": [...] },
 *     ...
 *   ]
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
 * Parser for vector-search plugin format.
 * This format wraps the vectors array in an object with metadata.
 */
export class VectorSearchParser implements EmbeddingParser {
	readonly name = "Vector-search plugin format";
	
	parse(data: unknown): ParseResult | null {
		console.log("Auto Related Links: VectorSearchParser attempting to parse...");
		
		// Must be an object (not array)
		if (typeof data !== "object" || data === null || Array.isArray(data)) {
			console.log("Auto Related Links: VectorSearchParser - not an object");
			return null;
		}
		
		const obj = data as Record<string, unknown>;
		console.log("Auto Related Links: VectorSearchParser - keys:", Object.keys(obj));
		
		// Must have "vectors" key with an array
		if (!("vectors" in obj) || !Array.isArray(obj.vectors)) {
			console.log("Auto Related Links: VectorSearchParser - no 'vectors' array found");
			return null;
		}
		
		const vectors = obj.vectors as unknown[];
		
		if (vectors.length === 0) {
			return {
				entries: [],
				errorCount: 0,
				formatDescription: "Vector-search format (empty)",
			};
		}
		
		// Check if first element looks like expected format
		const first = vectors[0];
		if (typeof first !== "object" || first === null) {
			return null;
		}
		
		const firstObj = first as Record<string, unknown>;
		if (!("path" in firstObj) || !("embedding" in firstObj)) {
			return null;
		}
		
		const entries: EmbeddingEntry[] = [];
		let errorCount = 0;
		
		for (const item of vectors) {
			if (typeof item !== "object" || item === null) {
				errorCount++;
				continue;
			}
			
			const itemObj = item as Record<string, unknown>;
			const path = itemObj.path;
			const embedding = itemObj.embedding;
			
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
		
		if (entries.length === 0) {
			return null;
		}
		
		// Extract model name if available for description
		const modelName = typeof obj.modelName === "string" ? obj.modelName : "unknown";
		
		return {
			entries,
			errorCount,
			formatDescription: `Vector-search format (${vectors.length} vectors, model: ${modelName})`,
		};
	}
}

