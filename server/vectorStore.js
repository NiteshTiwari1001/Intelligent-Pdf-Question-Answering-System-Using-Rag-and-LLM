const { QdrantClient } = require('@qdrant/js-client-rest');
const { QdrantVectorStore } = require('@langchain/qdrant');

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'pdf_docs';
const EMBEDDING_MODEL = 'jina-embeddings-v3';
const EXPECTED_VECTOR_SIZE = 1024; // jina-embeddings-v3 produces 1024-dim vectors
const JINA_BATCH_SIZE = 16;        // Jina allows up to 2048 inputs per request

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Minimal Jina AI embedding client.
 * Free tier: 1M tokens/month, no credit card required.
 * Sign up at https://jina.ai to get an API key, then set JINA_API_KEY in .env
 *
 * Uses task types for better retrieval quality:
 *   - "retrieval.passage" when indexing document chunks
 *   - "retrieval.query"   when embedding a search query
 */
class JinaClient {
  constructor(apiKey, model) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async _callApi(texts, task) {
    const response = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ input: texts, model: this.model, task }),
    });
    const json = await response.json();
    if (!response.ok || !Array.isArray(json.data)) {
      throw new Error(
        `Jina API error (HTTP ${response.status}): ` +
        (json.detail || json.message || JSON.stringify(json))
      );
    }
    return json.data.map((d) => d.embedding);
  }

  async embedDocuments(texts) {
    const results = [];
    for (let i = 0; i < texts.length; i += JINA_BATCH_SIZE) {
      const batch = texts.slice(i, i + JINA_BATCH_SIZE);
      const embeddings = await this._callApi(batch, 'retrieval.passage');
      results.push(...embeddings);
    }
    return results;
  }

  async embedQuery(text) {
    const [embedding] = await this._callApi([text], 'retrieval.query');
    return embedding;
  }
}

/**
 * Parses a 429 rate-limit error from any embedding provider and classifies it.
 *
 * Returns:
 *   { type: 'rpm', retryAfterMs }  — per-minute rate limit; wait then retry.
 *   null                            — not a recognisable rate-limit error.
 */
function parseQuotaError(err) {
  const msg = String(err?.message || '');
  const isQuota =
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Too Many Requests') ||
    msg.includes('rate limit') ||
    msg.includes('rate_limit');
  if (!isQuota) return null;

  const delayMatch =
    msg.match(/"retryDelay":"(\d+(?:\.\d+)?)s"/) ||
    msg.match(/retry after (\d+(?:\.\d+)?)/i) ||
    msg.match(/retry in (\d+(?:\.\d+)?)s/i);
  const retryAfterMs = delayMatch
    ? Math.ceil(parseFloat(delayMatch[1])) * 1000 + 2000
    : 65000;

  return { type: 'rpm', retryAfterMs };
}

const RATE_LIMIT_ERROR =
  '\u26A0\uFE0F  Jina AI rate limit exceeded — all retries exhausted. ' +
  'Check usage at https://jina.ai or retry later.';

/**
 * Re-embeds a sub-batch of texts with a single exponential back-off wait.
 * Called at the BATCH level, not the chunk level, to avoid 50x serial retries
 * when a whole batch fails due to quota exhaustion.
 *
 * Strategy: 
 *   attempt 1 — wait 60 s then retry the whole sub-batch
 *   attempt 2 — wait 120 s then retry the whole sub-batch
 *   attempt 3 — give up, return empty vectors for all remaining slots
 */
async function embedBatchWithBackoff(embeddings, texts, attempt = 1, maxAttempts = 3) {
  const waitMs = attempt * 60000; // 60 s, 120 s
  console.warn(
    `  ⏳ Batch-level rate-limit backoff: waiting ${waitMs / 1000}s before retry ${attempt}/${maxAttempts}…`
  );
  await sleep(waitMs);

  try {
    const vectors = await embeddings.embedDocuments(texts);
    const allValid = vectors.every(
      (v) => Array.isArray(v) && v.length === EXPECTED_VECTOR_SIZE
    );
    if (allValid) return vectors;

    // Still some empty slots — recurse unless exhausted
    if (attempt < maxAttempts) {
      return embedBatchWithBackoff(embeddings, texts, attempt + 1, maxAttempts);
    }
  } catch (err) {
    const quota = parseQuotaError(err);
    if (quota && attempt < maxAttempts) {
      return embedBatchWithBackoff(embeddings, texts, attempt + 1, maxAttempts);
    }
    if (attempt >= maxAttempts) throw new Error(RATE_LIMIT_ERROR);
  }

  // Exhausted — one last attempt
  try {
    return await embeddings.embedDocuments(texts);
  } catch (err) {
    throw new Error(RATE_LIMIT_ERROR);
  }
}
function createEmbeddings() {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) {
    throw new Error('Missing Jina AI API key. Set JINA_API_KEY in your .env file. Get one free at https://jina.ai');
  }
  return new JinaClient(apiKey, EMBEDDING_MODEL);
}

function createQdrantClient() {
  return new QdrantClient({
    url: QDRANT_URL,
    // Local Docker images may be slightly ahead of the JS client.
    checkCompatibility: false,
  });
}

function extractVectorSize(vectorsConfig) {
  if (!vectorsConfig) return null;

  if (typeof vectorsConfig.size === 'number') {
    return vectorsConfig.size;
  }

  if (typeof vectorsConfig === 'object') {
    const firstVector = Object.values(vectorsConfig).find(
      (value) => value && typeof value.size === 'number'
    );

    if (firstVector) {
      return firstVector.size;
    }
  }

  return null;
}

async function ensureCollectionVectorSize(client, recreateOnMismatch = true) {
  try {
    const collection = await client.getCollection(COLLECTION_NAME);

    // The @qdrant/js-client-rest SDK unwraps the HTTP envelope and returns the
    // result object directly — there is no extra `.result` wrapper here.
    const configuredSize = extractVectorSize(
      collection?.config?.params?.vectors
    );

    if (configuredSize === EXPECTED_VECTOR_SIZE) {
      return;
    }

    if (recreateOnMismatch) {
      await client.recreateCollection(COLLECTION_NAME, {
        vectors: {
          size: EXPECTED_VECTOR_SIZE,
          distance: "Cosine",
        },
      });
      console.warn(`⚠️ Recreated collection "${COLLECTION_NAME}" with size ${EXPECTED_VECTOR_SIZE}.`);
    }

  } catch (err) {
    if (err.status === 404) {
      await client.createCollection(COLLECTION_NAME, {
        vectors: {
          size: EXPECTED_VECTOR_SIZE,
          distance: "Cosine",
        },
      });
      console.log(`📦 Created collection "${COLLECTION_NAME}"`);
      return;
    }

    throw err;
  }
}

function assertEmbeddingVector(vector, contextLabel) {
  if (!Array.isArray(vector)) {
    throw new Error(`${contextLabel}: embedding is not an array.`);
  }

  if (vector.length === 0) {
    throw new Error(`${contextLabel}: embedding is empty (length 0).`);
  }

  if (vector.length !== EXPECTED_VECTOR_SIZE) {
    throw new Error(
      `${contextLabel}: embedding length ${vector.length} does not match expected ${EXPECTED_VECTOR_SIZE}.`
    );
  }
}

async function validateEmbeddingRuntime(embeddings) {
  const probeVector = await embeddings.embedQuery('embedding dimension health check');
  assertEmbeddingVector(probeVector, 'Embedding health-check failed');
}

async function validateEmbeddingBatchSample(embeddings, docs, sampleSize = 3) {
  const sampleTexts = docs
    .map((doc) => (doc?.pageContent || '').trim())
    .filter(Boolean)
    .slice(0, sampleSize);

  if (!sampleTexts.length) {
    throw new Error('No non-empty text chunks available for embedding.');
  }

  const sampleVectors = await embeddings.embedDocuments(sampleTexts);

  sampleVectors.forEach((vector, idx) => {
    assertEmbeddingVector(vector, `Embedding validation failed for chunk sample ${idx + 1}`);
  });
}

/**
 * Embeds a batch manually, validates every vector, and inserts only valid ones.
 * This bypasses QdrantVectorStore.addDocuments() which embeds internally and
 * would forward any empty/null vectors straight to Qdrant before we can inspect them.
 */
async function addDocumentsWithValidation(embeddings, vectorStore, docs) {
  const texts = docs.map((d) => d.pageContent);

  // Step 1 — batch embed (RETRIEVAL_DOCUMENT task type, correct for indexing).
  let vectors;
  try {
    vectors = await embeddings.embedDocuments(texts);
  } catch (err) {
    const quota = parseQuotaError(err);
    // Rate limit — hand off to batch-level backoff.
    if (quota) {
      console.warn(`⚠️  embedDocuments rate-limited — batch backoff: ${String(err.message).slice(0, 120)}`);
      vectors = await embedBatchWithBackoff(embeddings, texts);
    } else {
      throw err;
    }
  }

  // Step 2 — find any slots the API silently failed (rate-limit returns []).
  const invalidCount = vectors.filter(
    (v) => !Array.isArray(v) || v.length !== EXPECTED_VECTOR_SIZE
  ).length;

  // Step 3 — if any slots failed, treat it as a quota event and retry the
  // ENTIRE batch after a long pause. This avoids 50 serial individual retries.
  if (invalidCount > 0) {
    console.warn(
      `⚠️  ${invalidCount}/${docs.length} vectors were empty — triggering batch-level backoff retry…`
    );
    const retried = await embedBatchWithBackoff(embeddings, texts);
    retried.forEach((v, i) => { vectors[i] = v; });
  }

  // Step 4 — separate valid from still-invalid.
  const validVectors = [];
  const validDocs = [];
  let skipped = 0;

  vectors.forEach((vector, idx) => {
    if (Array.isArray(vector) && vector.length === EXPECTED_VECTOR_SIZE) {
      validVectors.push(vector);
      validDocs.push(docs[idx]);
    } else {
      skipped++;
      console.warn(`⚠️  Chunk ${idx} permanently skipped after retries.`);
    }
  });

  console.log(
    `📊 Batch: ${docs.length} chunks | ${validVectors.length} valid | ${skipped} skipped`
  );

  if (!validVectors.length) {
    throw new Error(
      `All ${docs.length} embeddings in this batch were invalid even after retries. ` +
      'Check Gemini API quota and key.'
    );
  }

  // addVectors takes pre-computed vectors — Qdrant never sees a dimension-0 payload.
  await vectorStore.addVectors(validVectors, validDocs);

  return { total: docs.length, valid: validVectors.length, skipped };
}

async function getVectorStore({
  embeddings,
  recreateOnMismatch = true,
  skipValidation = false,
} = {}) {
  const activeEmbeddings = embeddings || createEmbeddings();
  const client = createQdrantClient();

  // Skip the probe embed call on read-only paths (e.g. chat) to avoid
  // an unnecessary API round-trip on every request.
  if (!skipValidation) {
    await validateEmbeddingRuntime(activeEmbeddings);
  }

  await ensureCollectionVectorSize(client, recreateOnMismatch);

  const vectorStore = await QdrantVectorStore.fromExistingCollection(activeEmbeddings, {
    client,
    collectionName: COLLECTION_NAME,
  });

  return { vectorStore, client, embeddings: activeEmbeddings };
}

module.exports = {
  COLLECTION_NAME,
  EMBEDDING_MODEL,
  EXPECTED_VECTOR_SIZE,
  sleep,
  createEmbeddings,
  getVectorStore,
  validateEmbeddingBatchSample,
  addDocumentsWithValidation,
};
