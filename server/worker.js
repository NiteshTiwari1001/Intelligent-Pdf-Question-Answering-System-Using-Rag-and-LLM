require('dotenv').config();
const { Worker } = require('bullmq');
const { PDFLoader } = require('@langchain/community/document_loaders/fs/pdf');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const mongoose = require('mongoose');
const { Document } = require('./models');
const {
    sleep,
    createEmbeddings,
    getVectorStore,
    addDocumentsWithValidation,
} = require('./vectorStore');

// Jina AI free tier: 1M tokens/month, no credit card required.
const INTER_BATCH_DELAY_MS = 300;
const BATCH_SIZE = 50;

/**
 * Keeps only chunks that carry real semantic text.
 * Rejects page numbers, table fragments, symbol sequences, numeric-only lines,
 * and any other short non-linguistic debris that causes Gemini to return empty vectors.
 */
function cleanChunks(docs) {
    return docs.filter((doc) => {
        const text = (doc?.pageContent || '').trim();

        // Minimum length
        if (text.length < 40) return false;

        // Must contain at least one alphabetic character
        if (!/[a-zA-Z]/.test(text)) return false;

        // Must have at least 5 whitespace-separated tokens that are mostly letters
        const words = text.split(/\s+/).filter((w) => /[a-zA-Z]{2,}/.test(w));
        if (words.length < 5) return false;

        // Reject chunks that are mostly numbers/symbols (≥ 60 % non-alpha chars)
        const alphaChars = (text.match(/[a-zA-Z]/g) || []).length;
        if (alphaChars / text.length < 0.4) return false;

        // Drop typical table-row / bullet-only fragments: lines that are
        // dominated by short tokens separated by pipes, tabs, or multiple spaces
        const lines = text.split('\n').filter((l) => l.trim().length > 0);
        const tableLines = lines.filter((l) =>
            /^[\s\d.,|\-–:;()%$#@!*\/\\]+$/.test(l.trim())
        );
        if (lines.length > 0 && tableLines.length / lines.length > 0.6) return false;

        return true;
    });
}

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-research').then(() => {
    console.log('📊 Worker: MongoDB connected');
}).catch(err => {
    console.error('Worker: MongoDB connection error:', err);
});


const worker = new Worker('file_uplode', async job => {
    const startTime = Date.now();
    try {
        const data = JSON.parse(job.data);
        console.log('🔄 Processing PDF:', data.filename);

        const loader = new PDFLoader(data.path);
        const rawDocs = await loader.load();

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1500,
            chunkOverlap: 200,
            separators: ['\n\n', '\n', '. ', ' ', ''],
        });
        const rawChunks = await splitter.splitDocuments(rawDocs);
        console.log(`📄 Raw chunks: ${rawChunks.length}`);

        // Attach metadata and normalise whitespace first
        const withMetadata = rawChunks.map((doc, index) => {
            const text = (doc?.pageContent || '').replace(/\s+/g, ' ').trim();
            const pageNumber =
                doc.metadata?.loc?.pageNumber ||
                doc.metadata?.page ||
                1;
            return {
                ...doc,
                pageContent: text,
                metadata: {
                    pdfId: data.documentId,
                    source: data.filename,
                    filename: data.filename,
                    filepath: data.path,
                    pageNumber,
                    chunkIndex: index,
                    uploadedAt: new Date().toISOString(),
                },
            };
        });

        // Apply semantic quality filter
        const docs = cleanChunks(withMetadata);
        console.log(`🧹 Cleaned chunks: ${docs.length}`);
        console.log(`❌ Removed fragments: ${rawChunks.length - docs.length}`);

        if (!docs.length) {
            throw new Error('PDF produced no valid chunks after cleaning.');
        }
        const embeddings = createEmbeddings();
        const { vectorStore } = await getVectorStore({
            embeddings,
            recreateOnMismatch: true,
            skipValidation: true, // Skip probe embed — saves quota requests
        });

        console.log(`📄 Total chunks to insert: ${docs.length}`);

        let totalValid = 0;
        let totalSkipped = 0;
        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
            // Throttle after the first batch to respect Gemini RPM quota.
            if (i > 0) await sleep(INTER_BATCH_DELAY_MS);

            const batch = docs.slice(i, i + BATCH_SIZE);
            const { valid, skipped } = await addDocumentsWithValidation(embeddings, vectorStore, batch);
            totalValid += valid;
            totalSkipped += skipped;
        }
        console.log(`✅ Insertion complete: ${totalValid} vectors stored, ${totalSkipped} chunks skipped`);

        const processingTime = Date.now() - startTime;
        if (data.documentId) {
            await Document.findByIdAndUpdate(data.documentId, {
                status: 'completed',
                pageCount: rawDocs.length,
                chunkCount: docs.length,
                processingTime: processingTime
            });
        }

        console.log(`✅ PDF processed: ${data.filename} (${rawDocs.length} pages, ${docs.length} chunks, ${(processingTime / 1000).toFixed(2)}s)`);
    } catch (error) {
        console.error('❌ Worker error:', error);

        if (job?.data) {
            try {
                const data = JSON.parse(job.data);
                if (data.documentId) {
                    await Document.findByIdAndUpdate(data.documentId, {
                        status: 'failed',
                        errorMessage: error.message
                    });
                }
            } catch (parseError) {
                console.error('Failed to parse job data:', parseError);
            }
        }

        throw error;
    }
}, {
    concurrency: 3,
    connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379')
    },
    limiter: {
        max: 10,
        duration: 1000
    }
});

worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
});

console.log('🔧 Worker started and waiting for jobs...');
