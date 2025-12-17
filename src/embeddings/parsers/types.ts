/**
 * Types for embedding parsers.
 */

/**
 * Parsed embedding entry.
 */
export interface EmbeddingEntry {
	/** Vault-relative path to the file */
	path: string;
	/** Embedding vector as Float32Array */
	vector: Float32Array;
}

/**
 * Result of parsing an embeddings file.
 */
export interface ParseResult {
	/** Successfully parsed entries */
	entries: EmbeddingEntry[];
	/** Number of entries that failed to parse */
	errorCount: number;
	/** Description of detected format */
	formatDescription: string;
}

/**
 * Configuration for manual field mapping.
 */
export interface ManualMappingConfig {
	/** Key/path to the file path field */
	pathKey: string;
	/** Key/path to the embedding vector field */
	embeddingKey: string;
}

/**
 * Interface for embedding file parsers.
 */
export interface EmbeddingParser {
	/**
	 * Attempts to parse the JSON data.
	 * 
	 * @param data - Parsed JSON data
	 * @param config - Optional manual mapping configuration
	 * @returns ParseResult if successful, null if format not recognized
	 */
	parse(data: unknown, config?: ManualMappingConfig): ParseResult | null;
	
	/** Human-readable name for this parser */
	readonly name: string;
}

