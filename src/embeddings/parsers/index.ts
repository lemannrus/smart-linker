/**
 * Parser orchestrator for embeddings JSON files.
 * 
 * Supports auto-detection of format and manual mapping configuration.
 */

export type { EmbeddingEntry, ParseResult, ManualMappingConfig, EmbeddingParser } from "./types";
import type { ParseResult, ManualMappingConfig, EmbeddingParser } from "./types";
import { VectorSearchParser } from "./vectorSearchParser";
import { ArrayParser } from "./arrayParser";
import { MapParser } from "./mapParser";

/** All available parsers in order of priority */
const PARSERS: EmbeddingParser[] = [
	new VectorSearchParser(),  // Most common format (vector-search plugin)
	new ArrayParser(),
	new MapParser(),
];

/**
 * Attempts to parse embeddings JSON data using auto-detection.
 * Tries each parser in order until one succeeds.
 * 
 * @param data - Parsed JSON data
 * @returns ParseResult if successful, null if no parser recognized the format
 */
export function autoParseEmbeddings(data: unknown): ParseResult | null {
	for (const parser of PARSERS) {
		const result = parser.parse(data);
		if (result !== null) {
			return result;
		}
	}
	
	return null;
}

/**
 * Parses embeddings JSON data using manual field mapping.
 * Only tries the ArrayParser with the provided configuration.
 * 
 * @param data - Parsed JSON data
 * @param config - Manual mapping configuration
 * @returns ParseResult if successful, null if parsing failed
 */
export function parseWithManualMapping(
	data: unknown,
	config: ManualMappingConfig
): ParseResult | null {
	// Try ArrayParser with manual config first
	const arrayParser = new ArrayParser();
	const result = arrayParser.parse(data, config);
	
	if (result !== null) {
		return result;
	}
	
	// If array format didn't work and it's a map, try map parser
	const mapParser = new MapParser();
	const mapResult = mapParser.parse(data);
	
	if (mapResult !== null) {
		return mapResult;
	}
	
	return null;
}

/**
 * Gets list of available parser names.
 */
export function getAvailableParsers(): string[] {
	return PARSERS.map((p) => p.name);
}

