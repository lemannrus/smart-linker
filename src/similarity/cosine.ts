/**
 * Cosine similarity calculations for embeddings.
 */

/**
 * Computes the dot product of two vectors.
 * 
 * @param a - First vector
 * @param b - Second vector
 * @returns Dot product value
 */
export function dotProduct(a: Float32Array, b: Float32Array): number {
	if (a.length !== b.length) {
		throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
	}
	
	let sum = 0;
	for (let i = 0; i < a.length; i++) {
		sum += a[i] * b[i];
	}
	return sum;
}

/**
 * Computes the L2 (Euclidean) norm of a vector.
 * 
 * @param v - Vector
 * @returns L2 norm
 */
export function norm(v: Float32Array): number {
	let sum = 0;
	for (let i = 0; i < v.length; i++) {
		sum += v[i] * v[i];
	}
	return Math.sqrt(sum);
}

/**
 * Normalizes a vector to unit length (L2 norm = 1).
 * Returns a new Float32Array.
 * 
 * @param v - Vector to normalize
 * @returns Normalized vector (new array)
 */
export function normalize(v: Float32Array): Float32Array {
	const n = norm(v);
	if (n === 0) {
		// Return zero vector if input is zero vector
		return new Float32Array(v.length);
	}
	
	const result = new Float32Array(v.length);
	for (let i = 0; i < v.length; i++) {
		result[i] = v[i] / n;
	}
	return result;
}

/**
 * Computes cosine similarity between two vectors.
 * 
 * cosine_similarity(a, b) = dot(a, b) / (||a|| * ||b||)
 * 
 * For normalized vectors, this simplifies to just dot(a, b).
 * 
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity (-1 to 1, but typically 0-1 for embeddings)
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
	const dot = dotProduct(a, b);
	const normA = norm(a);
	const normB = norm(b);
	
	if (normA === 0 || normB === 0) {
		return 0;
	}
	
	return dot / (normA * normB);
}

/**
 * Computes cosine similarity between two pre-normalized vectors.
 * This is simply the dot product.
 * 
 * @param a - First normalized vector
 * @param b - Second normalized vector
 * @returns Cosine similarity
 */
export function cosineSimilarityNormalized(a: Float32Array, b: Float32Array): number {
	return dotProduct(a, b);
}

